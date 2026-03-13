import type { VideoJobFailureCode, VideoJobFailureStage, VideoJobRecord, VideoJobStatus } from './types'

export type VideoJobLifecycleUpdate = {
  status?: VideoJobStatus
  progress?: number
  provider_job_id?: string | null
  source_generation_job_id?: string | null
  error_message?: string | null
  metadata?: Record<string, unknown>
  failure_stage?: VideoJobFailureStage | null
  failure_code?: VideoJobFailureCode | null
  heartbeat?: boolean
}

export function buildVideoJobLifecyclePatch(update: VideoJobLifecycleUpdate) {
  const now = new Date().toISOString()
  const patch: Record<string, unknown> = {
    ...('status' in update ? { status: update.status } : {}),
    ...('progress' in update ? { progress: update.progress } : {}),
    ...('provider_job_id' in update ? { provider_job_id: update.provider_job_id } : {}),
    ...('source_generation_job_id' in update ? { source_generation_job_id: update.source_generation_job_id } : {}),
    ...('error_message' in update ? { error_message: update.error_message } : {}),
    ...('metadata' in update ? { metadata: update.metadata } : {}),
    ...('failure_stage' in update ? { failure_stage: update.failure_stage } : {}),
    ...('failure_code' in update ? { failure_code: update.failure_code } : {}),
  }

  if (update.heartbeat || update.status) {
    patch.last_heartbeat_at = now
  }

  if (update.status && ['planning', 'generating_assets', 'rendering', 'uploading'].includes(update.status)) {
    patch.started_at = now
    patch.completed_at = null
    patch.failed_at = null
  }

  if (update.status === 'completed') {
    patch.completed_at = now
    patch.failed_at = null
    patch.failure_stage = null
    patch.failure_code = null
  }

  if (update.status === 'failed') {
    patch.failed_at = now
    patch.completed_at = null
  }

  if (update.status === 'cancelled') {
    patch.failed_at = now
    patch.completed_at = null
  }

  if (update.status === 'queued' && !('error_message' in update)) {
    patch.error_message = null
  }

  return patch
}

export function buildRetryVideoJobPatch(job: VideoJobRecord) {
  const now = new Date().toISOString()
  return {
    status: 'queued' as const,
    progress: 0,
    error_message: null,
    source_generation_job_id: null,
    provider_job_id: null,
    failure_stage: null,
    failure_code: null,
    started_at: null,
    completed_at: null,
    failed_at: null,
    last_heartbeat_at: now,
    retry_count: (job.retry_count ?? 0) + 1,
    metadata: {
      ...job.metadata,
      lastRetryAt: now,
    },
  }
}

export function buildCancelVideoJobPatch(
  job: VideoJobRecord,
  actorId: string
): {
  status: 'cancelled'
  progress: number
  error_message: string
  failure_stage: VideoJobFailureStage
  failure_code: 'cancellation_completed'
  last_heartbeat_at: string
  metadata: Record<string, unknown>
} {
  const now = new Date().toISOString()
  return {
    status: 'cancelled' as const,
    progress: job.progress,
    error_message: 'Cancelled by user.',
    failure_stage:
      job.status === 'planning' ||
      job.status === 'generating_assets' ||
      job.status === 'rendering' ||
      job.status === 'uploading'
        ? job.status
        : 'unknown' as const,
    failure_code: 'cancellation_completed' as const,
    last_heartbeat_at: now,
    metadata: {
      ...job.metadata,
      cancellation: {
        requestedAt: now,
        cancelledAt: now,
        requestedBy: actorId,
        reason: 'Cancelled by user.',
      },
    },
  }
}
