import type { AppSession } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import { isMissingRelationError } from '@/server/supabase/errors'
import type { CreateVideoJobInput, VideoJobDetail, VideoJobRecord } from './types'
import type { VideoJobLifecycleUpdate } from './lifecycle'
import { buildVideoJobLifecyclePatch } from './lifecycle'
import { deriveVideoJobDiagnostics } from './diagnostics'

const TABLE = 'video_jobs'

export async function listVideoJobs(session: AppSession): Promise<VideoJobRecord[]> {
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

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
  })) as VideoJobRecord[]
}

export async function createVideoJob(session: AppSession, input: CreateVideoJobInput): Promise<VideoJobRecord> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .insert({
      org_id: session.orgId,
      job_kind: input.jobKind ?? 'video',
      project_id: input.projectId ?? null,
      campaign_id: input.campaignId ?? null,
      brand_kit_id: input.brandKitId ?? null,
      scheduled_content_run_id: input.scheduledContentRunId ?? null,
      scheduled_content_run_execution_id: input.scheduledContentRunExecutionId ?? null,
      title: input.title,
      brief: input.brief,
      script: input.script ?? null,
      provider: input.provider ?? 'comfyui',
      status: 'queued',
      progress: 0,
      created_by: session.userId,
      metadata: {
        ...(input.metadata ?? {}),
        workflowTemplateId: input.workflowTemplateId ?? null,
        influencerId: input.influencerId ?? null,
        inputs: input.inputs ?? {},
      },
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return {
    ...(data as Record<string, unknown>),
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata as Record<string, unknown> : {},
  } as VideoJobRecord
}

export async function updateVideoJobRecordFields(
  session: AppSession,
  jobId: string,
  input: Partial<CreateVideoJobInput>
): Promise<VideoJobRecord> {
  const admin = getSupabaseAdmin()
  const { data: existing, error: existingError } = await admin
    .from(TABLE)
    .select('*')
    .eq('id', jobId)
    .eq('org_id', session.orgId)
    .single()

  if (existingError) {
    throw existingError
  }

  const nextMetadata = {
    ...(existing.metadata && typeof existing.metadata === 'object' ? existing.metadata as Record<string, unknown> : {}),
    ...(input.metadata ?? {}),
    ...(input.workflowTemplateId !== undefined ? { workflowTemplateId: input.workflowTemplateId } : {}),
    ...(input.influencerId !== undefined ? { influencerId: input.influencerId } : {}),
    ...(input.inputs !== undefined ? { inputs: input.inputs } : {}),
  }

  const { data, error } = await admin
    .from(TABLE)
    .update({
      job_kind: input.jobKind ?? existing.job_kind,
      project_id: input.projectId ?? existing.project_id,
      campaign_id: input.campaignId ?? existing.campaign_id,
      brand_kit_id: input.brandKitId ?? existing.brand_kit_id,
      title: input.title ?? existing.title,
      brief: input.brief ?? existing.brief,
      script: input.script ?? existing.script,
      provider: input.provider ?? existing.provider,
      metadata: nextMetadata,
    })
    .eq('id', jobId)
    .eq('org_id', session.orgId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return {
    ...(data as Record<string, unknown>),
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata as Record<string, unknown> : {},
  } as VideoJobRecord
}

export async function updateVideoJob(
  jobId: string,
  updates: Partial<Pick<VideoJobRecord, 'source_generation_job_id' | 'provider_job_id' | 'status' | 'progress' | 'error_message' | 'metadata' | 'retry_count' | 'started_at' | 'completed_at' | 'failed_at' | 'last_heartbeat_at' | 'failure_stage' | 'failure_code'>>
) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .update(updates)
    .eq('id', jobId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return {
    ...(data as Record<string, unknown>),
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata as Record<string, unknown> : {},
  } as VideoJobRecord
}

export async function applyVideoJobLifecycleUpdate(jobId: string, update: VideoJobLifecycleUpdate) {
  const admin = getSupabaseAdmin()
  const { data: existing, error } = await admin
    .from(TABLE)
    .select('id, started_at')
    .eq('id', jobId)
    .single()

  if (error) {
    throw error
  }

  const patch = buildVideoJobLifecyclePatch(update)

  if (existing?.started_at && patch.started_at && update.status && update.status !== 'failed' && update.status !== 'completed') {
    patch.started_at = existing.started_at
  }

  return updateVideoJob(jobId, patch)
}

export async function getVideoJobDetail(session: AppSession, jobId: string): Promise<VideoJobDetail | null> {
  const admin = getSupabaseAdmin()
  const { data: job, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('id', jobId)
    .eq('org_id', session.orgId)
    .maybeSingle()

  if (error) {
    if (isMissingRelationError(error)) {
      return null
    }

    throw error
  }

  if (!job) {
    return null
  }

  let assets: VideoJobDetail['assets'] = []

  if (job.source_generation_job_id) {
    const { data: assetRows, error: assetError } = await admin
      .from('generated_assets')
      .select('id, kind, storage_url, created_at')
      .eq('generation_job_id', job.source_generation_job_id)
      .order('created_at', { ascending: false })

    if (assetError) {
      throw assetError
    }

    assets = (assetRows ?? []) as VideoJobDetail['assets']
  }

  return {
    job: {
      ...(job as Record<string, unknown>),
      metadata: job.metadata && typeof job.metadata === 'object' ? job.metadata as Record<string, unknown> : {},
    } as VideoJobRecord,
    assets,
  }
}

export async function getVideoJobById(session: AppSession, jobId: string): Promise<VideoJobRecord | null> {
  const detail = await getVideoJobDetail(session, jobId)
  if (!detail) {
    return null
  }
  return detail.job
}

export function withVideoJobDiagnostics(job: VideoJobRecord) {
  return {
    ...job,
    diagnostics: deriveVideoJobDiagnostics(job),
  }
}

export async function getGenerationJob(generationJobId: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('generation_jobs')
    .select('id, status, prompt_id, error, progress_json')
    .eq('id', generationJobId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}

export async function getVideoJobByGenerationJobId(generationJobId: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('source_generation_job_id', generationJobId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return {
    ...(data as Record<string, unknown>),
    metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata as Record<string, unknown> : {},
  } as VideoJobRecord
}

export async function cancelLinkedGenerationJob(generationJobId: string, message: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('generation_jobs')
    .update({
      status: 'CANCELED',
      error: message,
      progress_json: {
        status: 'cancelled',
        percent: 100,
        message,
        updatedAt: new Date().toISOString(),
      },
    })
    .eq('id', generationJobId)
    .neq('status', 'READY')
    .neq('status', 'FAILED')
    .neq('status', 'CANCELED')
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  return data
}
