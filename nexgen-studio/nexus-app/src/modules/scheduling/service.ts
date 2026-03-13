import type { AppSession } from '@/server/auth/session'
import { createApiError } from '@/server/api/route'
import { createVideoJobRecord } from '@/modules/video-jobs'
import type { CreateVideoJobInput } from '@/modules/video-jobs'
import {
  claimScheduledContentRun,
  completeScheduleExecution,
  createScheduleExecution,
  createScheduledContentRun,
  failScheduleExecution,
  getScheduledContentRunById,
  getScheduledContentRunDetail,
  listDueScheduledContentRuns,
  listScheduledContentRuns,
  patchScheduledContentRun,
  updateScheduledContentRun,
} from './repository'
import { computeInitialNextRunAt, computeNextRunAtFromScheduled, formatScheduledLabel } from './recurrence'
import type {
  CreateScheduledContentRunInput,
  ScheduledContentRunDetail,
  ScheduledContentRunRecord,
  UpdateScheduledContentRunInput,
} from './types'

function scheduleSession(schedule: ScheduledContentRunRecord): AppSession {
  return {
    orgId: schedule.org_id,
    userId: schedule.created_by,
    email: null,
    name: null,
  }
}

function getScheduleInputs(schedule: ScheduledContentRunRecord) {
  const metadata = schedule.metadata && typeof schedule.metadata === 'object'
    ? schedule.metadata as Record<string, unknown>
    : {}
  return metadata.inputs && typeof metadata.inputs === 'object'
    ? metadata.inputs as Record<string, unknown>
    : {}
}

function buildScheduledJobInput(
  schedule: ScheduledContentRunRecord,
  executionId: string,
  sequenceIndex: number
): CreateVideoJobInput {
  const inputs = getScheduleInputs(schedule)

  return {
    jobKind: schedule.job_kind,
    projectId: schedule.project_id ?? undefined,
    campaignId: schedule.campaign_id ?? undefined,
    brandKitId: schedule.brand_kit_id ?? undefined,
    scheduledContentRunId: schedule.id,
    scheduledContentRunExecutionId: executionId,
    title:
      schedule.jobs_per_run > 1
        ? `${schedule.title} #${sequenceIndex + 1}`
        : schedule.title,
    brief: schedule.brief,
    script: schedule.script ?? undefined,
    provider: schedule.provider,
    workflowTemplateId: schedule.workflow_template_id ?? undefined,
    influencerId: schedule.influencer_id ?? undefined,
    metadata: {
      scheduleId: schedule.id,
      scheduledContentRunExecutionId: executionId,
      scheduledOrigin: true,
    },
    inputs: {
      ...inputs,
      schedule_title: schedule.title,
      schedule_sequence: sequenceIndex + 1,
      schedule_frequency: schedule.frequency,
      schedule_label: formatScheduledLabel({
        frequency: schedule.frequency,
        dayOfWeek: schedule.day_of_week,
        timeOfDay: schedule.time_of_day,
        timezone: schedule.timezone,
      }),
    },
  }
}

function buildNextRunAt(input: {
  frequency: CreateScheduledContentRunInput['frequency']
  dayOfWeek?: number
  timeOfDay: string
  timezone: string
}) {
  return computeInitialNextRunAt({
    frequency: input.frequency,
    dayOfWeek: input.dayOfWeek,
    timeOfDay: input.timeOfDay,
    timezone: input.timezone,
  })
}

async function executeSchedule(
  schedule: ScheduledContentRunRecord,
  options: {
    triggerType: 'recurrence' | 'manual'
    scheduledFor: string
    statusAfterRun: 'scheduled' | 'paused'
  }
) {
  const execution = await createScheduleExecution({
    scheduleId: schedule.id,
    orgId: schedule.org_id,
    scheduledFor: options.scheduledFor,
    triggerType: options.triggerType,
    jobsRequested: schedule.jobs_per_run,
    metadata: {
      frequency: schedule.frequency,
      jobKind: schedule.job_kind,
    },
  })

  const createdJobIds: string[] = []

  try {
    for (let index = 0; index < schedule.jobs_per_run; index += 1) {
      const result = await createVideoJobRecord(
        scheduleSession(schedule),
        buildScheduledJobInput(schedule, execution.id, index)
      )
      const jobId = result.job.id
      createdJobIds.push(jobId)
    }

    await completeScheduleExecution(execution.id, {
      jobsCreated: createdJobIds.length,
      metadata: {
        createdJobIds,
      },
    })

    await patchScheduledContentRun(schedule.id, schedule.org_id, {
      status: options.statusAfterRun,
      last_success_at: new Date().toISOString(),
      last_error_message: null,
    })

    return {
      executionId: execution.id,
      createdJobIds,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scheduled content run failed'

    await failScheduleExecution(execution.id, {
      jobsCreated: createdJobIds.length,
      errorMessage: message,
      metadata: {
        createdJobIds,
      },
    })

    await patchScheduledContentRun(schedule.id, schedule.org_id, {
      status: options.statusAfterRun,
      last_failure_at: new Date().toISOString(),
      last_error_message: message,
    })

    throw error
  }
}

export async function getScheduledContentRuns(session: AppSession) {
  return listScheduledContentRuns(session)
}

export async function getScheduledContentRun(session: AppSession, scheduleId: string): Promise<ScheduledContentRunDetail> {
  const detail = await getScheduledContentRunDetail(session, scheduleId)

  if (!detail) {
    throw createApiError(404, 'Scheduled content run not found')
  }

  return detail
}

export async function createScheduledContentRunRecord(
  session: AppSession,
  input: CreateScheduledContentRunInput
) {
  const nextRunAt = buildNextRunAt(input)
  return createScheduledContentRun(session, input, nextRunAt)
}

export async function updateScheduledContentRunRecord(
  session: AppSession,
  scheduleId: string,
  input: UpdateScheduledContentRunInput
) {
  const existing = await getScheduledContentRunById(session, scheduleId)
  if (!existing) {
    throw createApiError(404, 'Scheduled content run not found')
  }

  const nextRunAt =
    existing.status === 'paused' && existing.next_run_at
      ? existing.next_run_at
      : buildNextRunAt(input)

  return updateScheduledContentRun(session, scheduleId, input, nextRunAt)
}

export async function pauseScheduledContentRun(session: AppSession, scheduleId: string) {
  const schedule = await getScheduledContentRunById(session, scheduleId)
  if (!schedule) {
    throw createApiError(404, 'Scheduled content run not found')
  }

  if (schedule.status === 'paused') {
    return schedule
  }

  return patchScheduledContentRun(schedule.id, session.orgId, {
    status: 'paused',
  })
}

export async function resumeScheduledContentRun(session: AppSession, scheduleId: string) {
  const schedule = await getScheduledContentRunById(session, scheduleId)
  if (!schedule) {
    throw createApiError(404, 'Scheduled content run not found')
  }

  const nextRunAt = computeInitialNextRunAt({
    frequency: schedule.frequency,
    dayOfWeek: schedule.day_of_week,
    timeOfDay: schedule.time_of_day,
    timezone: schedule.timezone,
  })

  return patchScheduledContentRun(schedule.id, session.orgId, {
    status: 'scheduled',
    next_run_at: nextRunAt,
    last_error_message: null,
  })
}

export async function runScheduledContentRunNow(session: AppSession, scheduleId: string) {
  const schedule = await getScheduledContentRunById(session, scheduleId)
  if (!schedule) {
    throw createApiError(404, 'Scheduled content run not found')
  }

  if (schedule.status === 'running') {
    throw createApiError(409, 'This schedule is already running', {
      code: 'invalid_schedule_state',
    })
  }

  await patchScheduledContentRun(schedule.id, session.orgId, {
    status: 'running',
    last_run_at: new Date().toISOString(),
    last_error_message: null,
  })

  return executeSchedule(
    { ...schedule, status: 'running' },
    {
      triggerType: 'manual',
      scheduledFor: new Date().toISOString(),
      statusAfterRun: schedule.status === 'paused' ? 'paused' : 'scheduled',
    }
  )
}

export async function processDueScheduledContentRuns(limit = 10) {
  const nowIso = new Date().toISOString()
  const dueSchedules = await listDueScheduledContentRuns(limit, nowIso)
  let processed = 0

  for (const schedule of dueSchedules) {
    if (!schedule.next_run_at) {
      continue
    }

    const nextRunAt = computeNextRunAtFromScheduled({
      frequency: schedule.frequency,
      dayOfWeek: schedule.day_of_week,
      timeOfDay: schedule.time_of_day,
      timezone: schedule.timezone,
      scheduledFor: schedule.next_run_at,
    })

    const claimed = await claimScheduledContentRun(
      schedule.id,
      schedule.org_id,
      schedule.next_run_at,
      nextRunAt
    )

    if (!claimed) {
      continue
    }

    try {
      await executeSchedule(claimed, {
        triggerType: 'recurrence',
        scheduledFor: schedule.next_run_at,
        statusAfterRun: 'scheduled',
      })
    } finally {
      processed += 1
    }
  }

  return {
    processed,
  }
}
