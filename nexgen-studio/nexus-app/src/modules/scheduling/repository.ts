import type { AppSession } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import { isMissingColumnError, isMissingRelationError } from '@/server/supabase/errors'
import type {
  CreateScheduledContentRunInput,
  ScheduledContentRunDetail,
  ScheduledContentRunExecutionRecord,
  ScheduledContentRunJobSummary,
  ScheduledContentRunRecord,
  UpdateScheduledContentRunInput,
} from './types'

const TABLE = 'scheduled_content_runs'
const EXECUTIONS_TABLE = 'scheduled_content_run_executions'

function mapMetadata<T extends Record<string, unknown>>(row: Record<string, unknown>) {
  return {
    ...row,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
  } as unknown as T
}

function schedulePayload(
  session: Pick<AppSession, 'orgId' | 'userId'>,
  input: CreateScheduledContentRunInput | UpdateScheduledContentRunInput,
  nextRunAt: string
) {
  return {
    org_id: session.orgId,
    project_id: input.projectId ?? null,
    brand_kit_id: input.brandKitId ?? null,
    campaign_id: input.campaignId ?? null,
    workflow_template_id: input.workflowTemplateId ?? null,
    influencer_id: input.influencerId ?? null,
    schedule_key: crypto.randomUUID(),
    title: input.title,
    brief: input.brief,
    script: input.script ?? null,
    frequency: input.frequency,
    provider: input.provider ?? 'comfyui',
    job_kind: input.jobKind,
    jobs_per_run: input.jobsPerRun ?? 1,
    day_of_week: input.frequency === 'weekly' ? (input.dayOfWeek ?? null) : null,
    time_of_day: input.timeOfDay,
    timezone: input.timezone,
    status: 'scheduled',
    next_run_at: nextRunAt,
    created_by: session.userId,
    metadata: {
      inputs: input.inputs ?? {},
    },
  }
}

export async function listScheduledContentRuns(session: AppSession): Promise<ScheduledContentRunRecord[]> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('org_id', session.orgId)
    .order('created_at', { ascending: false })

  if (isMissingRelationError(error)) {
    return []
  }

  if (error) {
    throw error
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapMetadata<ScheduledContentRunRecord>(row)
  )
}

export async function createScheduledContentRun(
  session: AppSession,
  input: CreateScheduledContentRunInput,
  nextRunAt: string
) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .insert(schedulePayload(session, input, nextRunAt))
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return mapMetadata<ScheduledContentRunRecord>(data as Record<string, unknown>)
}

export async function getScheduledContentRunById(
  session: AppSession,
  scheduleId: string
): Promise<ScheduledContentRunRecord | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('id', scheduleId)
    .eq('org_id', session.orgId)
    .maybeSingle()

  if (isMissingRelationError(error)) {
    return null
  }

  if (error) {
    throw error
  }

  return data ? mapMetadata<ScheduledContentRunRecord>(data as Record<string, unknown>) : null
}

export async function updateScheduledContentRun(
  session: AppSession,
  scheduleId: string,
  input: UpdateScheduledContentRunInput,
  nextRunAt: string
) {
  const admin = getSupabaseAdmin()
  const payload = schedulePayload(session, input, nextRunAt)
  delete (payload as { created_by?: string }).created_by
  delete (payload as { schedule_key?: string }).schedule_key

  const { data, error } = await admin
    .from(TABLE)
    .update(payload)
    .eq('id', scheduleId)
    .eq('org_id', session.orgId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return mapMetadata<ScheduledContentRunRecord>(data as Record<string, unknown>)
}

export async function patchScheduledContentRun(
  scheduleId: string,
  orgId: string,
  updates: Record<string, unknown>
) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .update(updates)
    .eq('id', scheduleId)
    .eq('org_id', orgId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return mapMetadata<ScheduledContentRunRecord>(data as Record<string, unknown>)
}

export async function getScheduledContentRunDetail(
  session: AppSession,
  scheduleId: string
): Promise<ScheduledContentRunDetail | null> {
  const admin = getSupabaseAdmin()
  const schedule = await getScheduledContentRunById(session, scheduleId)

  if (!schedule) {
    return null
  }

  const [executionsResult, jobsResult] = await Promise.all([
    admin
      .from(EXECUTIONS_TABLE)
      .select('*')
      .eq('scheduled_content_run_id', scheduleId)
      .eq('org_id', session.orgId)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('video_jobs')
      .select('id, title, job_kind, status, progress, created_at, scheduled_content_run_execution_id')
      .eq('scheduled_content_run_id', scheduleId)
      .eq('org_id', session.orgId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (executionsResult.error) {
    if (isMissingRelationError(executionsResult.error)) {
      return {
        schedule,
        executions: [],
        jobs: [],
      }
    }
    throw executionsResult.error
  }

  if (jobsResult.error) {
    if (isMissingColumnError(jobsResult.error) || isMissingRelationError(jobsResult.error)) {
      return {
        schedule,
        executions: ((executionsResult.data ?? []) as Array<Record<string, unknown>>).map((row) =>
          mapMetadata<ScheduledContentRunExecutionRecord>(row)
        ),
        jobs: [],
      }
    }
    throw jobsResult.error
  }

  return {
    schedule,
    executions: ((executionsResult.data ?? []) as Array<Record<string, unknown>>).map((row) =>
      mapMetadata<ScheduledContentRunExecutionRecord>(row)
    ),
    jobs: ((jobsResult.data ?? []) as Array<Record<string, unknown>>) as ScheduledContentRunJobSummary[],
  }
}

export async function listDueScheduledContentRuns(limit: number, nowIso: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('status', 'scheduled')
    .lte('next_run_at', nowIso)
    .order('next_run_at', { ascending: true })
    .limit(limit)

  if (error) {
    if (isMissingRelationError(error)) {
      return []
    }
    throw error
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapMetadata<ScheduledContentRunRecord>(row)
  )
}

export async function claimScheduledContentRun(
  scheduleId: string,
  orgId: string,
  expectedNextRunAt: string,
  nextRunAt: string
) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .update({
      status: 'running',
      next_run_at: nextRunAt,
      last_run_at: new Date().toISOString(),
      last_error_message: null,
    })
    .eq('id', scheduleId)
    .eq('org_id', orgId)
    .eq('status', 'scheduled')
    .eq('next_run_at', expectedNextRunAt)
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data ? mapMetadata<ScheduledContentRunRecord>(data as Record<string, unknown>) : null
}

export async function createScheduleExecution(input: {
  scheduleId: string
  orgId: string
  scheduledFor: string
  triggerType: 'recurrence' | 'manual'
  jobsRequested: number
  metadata?: Record<string, unknown>
}) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(EXECUTIONS_TABLE)
    .insert({
      scheduled_content_run_id: input.scheduleId,
      org_id: input.orgId,
      trigger_type: input.triggerType,
      scheduled_for: input.scheduledFor,
      jobs_requested: input.jobsRequested,
      status: 'running',
      metadata: input.metadata ?? {},
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return mapMetadata<ScheduledContentRunExecutionRecord>(data as Record<string, unknown>)
}

export async function completeScheduleExecution(
  executionId: string,
  updates: {
    jobsCreated: number
    metadata?: Record<string, unknown>
  }
) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(EXECUTIONS_TABLE)
    .update({
      status: 'completed',
      jobs_created: updates.jobsCreated,
      completed_at: new Date().toISOString(),
      error_message: null,
      metadata: updates.metadata ?? {},
    })
    .eq('id', executionId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return mapMetadata<ScheduledContentRunExecutionRecord>(data as Record<string, unknown>)
}

export async function failScheduleExecution(
  executionId: string,
  updates: {
    jobsCreated: number
    errorMessage: string
    metadata?: Record<string, unknown>
  }
) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(EXECUTIONS_TABLE)
    .update({
      status: 'failed',
      jobs_created: updates.jobsCreated,
      failed_at: new Date().toISOString(),
      error_message: updates.errorMessage,
      metadata: updates.metadata ?? {},
    })
    .eq('id', executionId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return mapMetadata<ScheduledContentRunExecutionRecord>(data as Record<string, unknown>)
}

export async function listScheduleExecutionsByOrg(orgId: string, limit: number) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(EXECUTIONS_TABLE)
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) =>
    mapMetadata<ScheduledContentRunExecutionRecord>(row)
  )
}
