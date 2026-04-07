/**
 * Video Jobs Service - Campaign Layer for Generation Jobs
 *
 * STATUS TRUTH HIERARCHY:
 *   generation_jobs (source) -> video_jobs (sync on read)
 *
 * SYNC BEHAVIOR:
 * - getVideoJobById() performs ON-DEMAND SYNC from generation_jobs
 * - This syncs status when a user views a job, ensuring fresh data
 * - Campaign context (project_id, campaign_id) is managed in video_jobs
 * - Generation status is the source of truth in generation_jobs
 *
 * For new code, prefer reading from generation_jobs directly when possible.
 */

import type { AppSession } from '@/server/auth/session'
import { getQueueProvider } from '@/server/providers/queue'
import { createApiError } from '@/server/api/route'
import { recordUsageEvent } from '@/modules/usage-events'
import { mapGenerationStatusToVideoLifecycle } from './mapper'
import {
  applyVideoJobLifecycleUpdate,
  cancelLinkedGenerationJob,
  createVideoJob,
  getGenerationJob,
  getVideoJobById as getVideoJobRecordById,
  getVideoJobDetail,
  listVideoJobs,
  updateVideoJobRecordFields,
  updateVideoJob as persistVideoJobUpdates,
  withVideoJobDiagnostics,
} from './repository'
import type { CreateVideoJobInput, VideoJobFailureCode, VideoJobFailureStage } from './types'
import { buildCancelVideoJobPatch, buildRetryVideoJobPatch } from './lifecycle'
import { deriveVideoJobDiagnostics, isCancellableVideoJobStatus } from './diagnostics'

export async function getVideoJobs(session: AppSession) {
  const jobs = await listVideoJobs(session)
  return jobs.map(withVideoJobDiagnostics)
}

export async function getVideoJobById(session: AppSession, jobId: string) {
  const detail = await getVideoJobDetail(session, jobId)

  if (!detail) {
    throw createApiError(404, 'Generation job not found')
  }

  if (detail.job.source_generation_job_id && detail.job.status !== 'cancelled') {
    const generationJob = await getGenerationJob(detail.job.source_generation_job_id)

    if (generationJob?.status) {
      const lifecycle = mapGenerationStatusToVideoLifecycle(generationJob.status)
      const progressJson =
        generationJob.progress_json && typeof generationJob.progress_json === 'object'
          ? generationJob.progress_json as Record<string, unknown>
          : null
      const mappedProgress =
        progressJson && typeof progressJson.percent === 'number'
          ? progressJson.percent
          : lifecycle.progress
      if (lifecycle.status !== detail.job.status || mappedProgress !== detail.job.progress) {
        detail.job = await applyVideoJobLifecycleUpdate(detail.job.id, {
          status: lifecycle.status,
          progress: mappedProgress,
          provider_job_id:
            typeof generationJob.prompt_id === 'string'
              ? generationJob.prompt_id
              : detail.job.provider_job_id,
          error_message:
            typeof generationJob.error === 'string'
              ? generationJob.error
              : lifecycle.status === 'cancelled'
                ? 'Upstream generation was cancelled.'
                : detail.job.error_message,
          failure_stage:
            lifecycle.status === 'failed' || lifecycle.status === 'cancelled'
              ? 'provider_sync'
              : null,
          failure_code:
            lifecycle.status === 'failed'
              ? classifyUnderlyingGenerationFailure(generationJob.error)
              : lifecycle.status === 'cancelled'
                ? 'provider_cancelled'
                : null,
          heartbeat:
            lifecycle.status !== 'completed' &&
            lifecycle.status !== 'failed' &&
            lifecycle.status !== 'cancelled',
        })
      }
    }
  }

  return {
    ...detail,
    job: withVideoJobDiagnostics(detail.job),
  }
}

export async function createVideoJobRecord(session: AppSession, input: CreateVideoJobInput) {
  const videoJob = await createVideoJob(session, input)
  await recordUsageEvent({
    eventKey: `${videoJob.id}:attempt:0:job_queued`,
    orgId: session.orgId,
    userId: session.userId,
    projectId: videoJob.project_id,
    campaignId: videoJob.campaign_id,
    videoJobId: videoJob.id,
    workflowTemplateId:
      typeof videoJob.metadata.workflowTemplateId === 'string'
        ? videoJob.metadata.workflowTemplateId
        : null,
    eventName: 'job_queued',
    jobKind: videoJob.job_kind,
    provider: videoJob.provider,
    units: 1,
    unitType: 'count',
    metadata: {
      retryCount: videoJob.retry_count ?? 0,
      source: 'video-jobs.create',
    },
  })
  await getQueueProvider().enqueue('video:jobs', {
    type: 'video-job.created',
    id: videoJob.id,
    metadata: {
      orgId: session.orgId,
    },
  })

  return getVideoJobById(session, videoJob.id)
}

export async function updateVideoJobRecord(session: AppSession, jobId: string, input: Partial<CreateVideoJobInput>) {
  return updateVideoJobRecordFields(session, jobId, input)
}

export async function retryVideoJob(session: AppSession, jobId: string) {
  const job = await getVideoJobRecordById(session, jobId)

  if (!job) {
    throw createApiError(404, 'Generation job not found')
  }

  if (job.status !== 'failed') {
    throw createApiError(409, 'Only failed generation jobs can be retried', {
      code: 'invalid_job_state',
    })
  }

  const patched = await persistVideoJobUpdates(job.id, buildRetryVideoJobPatch(job))
  await recordUsageEvent({
    eventKey: `${job.id}:retry:${patched.retry_count}:job_retried`,
    orgId: session.orgId,
    userId: session.userId,
    projectId: patched.project_id,
    campaignId: patched.campaign_id,
    videoJobId: patched.id,
    workflowTemplateId:
      typeof patched.metadata.workflowTemplateId === 'string'
        ? patched.metadata.workflowTemplateId
        : null,
    eventName: 'job_retried',
    jobKind: patched.job_kind,
    provider: patched.provider,
    units: 1,
    unitType: 'count',
    metadata: {
      retryCount: patched.retry_count,
      source: 'video-jobs.retry',
    },
  })
  await recordUsageEvent({
    eventKey: `${job.id}:attempt:${patched.retry_count}:job_queued`,
    orgId: session.orgId,
    userId: session.userId,
    projectId: patched.project_id,
    campaignId: patched.campaign_id,
    videoJobId: patched.id,
    workflowTemplateId:
      typeof patched.metadata.workflowTemplateId === 'string'
        ? patched.metadata.workflowTemplateId
        : null,
    eventName: 'job_queued',
    jobKind: patched.job_kind,
    provider: patched.provider,
    units: 1,
    unitType: 'count',
    metadata: {
      retryCount: patched.retry_count,
      source: 'video-jobs.retry',
    },
  })

  await getQueueProvider().enqueue('video:jobs', {
    type: 'video-job.retry',
    id: job.id,
    metadata: {
      orgId: session.orgId,
      retryCount: patched.retry_count,
    },
  })

  return withVideoJobDiagnostics(patched)
}

export async function cancelVideoJob(session: AppSession, jobId: string) {
  const job = await getVideoJobRecordById(session, jobId)

  if (!job) {
    throw createApiError(404, 'Generation job not found')
  }

  if (!isCancellableVideoJobStatus(job.status)) {
    throw createApiError(409, 'Only queued or active generation jobs can be cancelled', {
      code: 'invalid_job_state',
    })
  }

  let upstreamCancellationError: string | null = null
  if (job.source_generation_job_id) {
    try {
      await cancelLinkedGenerationJob(job.source_generation_job_id, 'Cancelled by user.')
    } catch (error) {
      upstreamCancellationError = error instanceof Error
        ? error.message
        : 'Failed to update linked generation job during cancellation.'
    }
  }

  const patch = buildCancelVideoJobPatch(job, session.userId)

  if (upstreamCancellationError) {
    const currentMetadata = patch.metadata as Record<string, unknown>
    const existingCancellation =
      currentMetadata.cancellation && typeof currentMetadata.cancellation === 'object'
        ? currentMetadata.cancellation as Record<string, unknown>
        : {}

    patch.metadata = {
      ...currentMetadata,
      cancellation: {
        ...existingCancellation,
        upstreamCancellation: 'best_effort_failed',
        upstreamError: upstreamCancellationError,
      },
    }
  }

  const patched = await persistVideoJobUpdates(job.id, patch)
  await recordUsageEvent({
    eventKey: `${patched.id}:attempt:${patched.retry_count}:job_cancelled`,
    orgId: session.orgId,
    userId: session.userId,
    projectId: patched.project_id,
    campaignId: patched.campaign_id,
    videoJobId: patched.id,
    generationJobId: patched.source_generation_job_id,
    workflowTemplateId:
      typeof patched.metadata.workflowTemplateId === 'string'
        ? patched.metadata.workflowTemplateId
        : null,
    eventName: 'job_cancelled',
    jobKind: patched.job_kind,
    provider: patched.provider,
    units: 1,
    unitType: 'count',
    metadata: {
      retryCount: patched.retry_count,
      source: 'video-jobs.cancel',
    },
  })
  return withVideoJobDiagnostics(patched)
}

export async function duplicateVideoJob(session: AppSession, jobId: string) {
  const job = await getVideoJobRecordById(session, jobId)

  if (!job) {
    throw createApiError(404, 'Generation job not found')
  }

  const metadata = job.metadata && typeof job.metadata === 'object'
    ? job.metadata as Record<string, unknown>
    : {}
  const inputs =
    metadata.inputs && typeof metadata.inputs === 'object'
      ? metadata.inputs as Record<string, unknown>
      : {}

  const duplicated = await createVideoJob(session, {
    jobKind: job.job_kind,
    projectId: job.project_id ?? undefined,
    campaignId: job.campaign_id ?? undefined,
    brandKitId: job.brand_kit_id ?? undefined,
    title: job.title,
    brief: job.brief,
    script: job.script ?? undefined,
    provider: job.provider,
    workflowTemplateId:
      typeof metadata.workflowTemplateId === 'string' ? metadata.workflowTemplateId : undefined,
    influencerId:
      typeof metadata.influencerId === 'string' ? metadata.influencerId : undefined,
    inputs,
    metadata: {
      duplicatedFromVideoJobId: job.id,
      duplicatedAt: new Date().toISOString(),
    },
  })
  await recordUsageEvent({
    eventKey: `${duplicated.id}:attempt:0:job_queued`,
    orgId: session.orgId,
    userId: session.userId,
    projectId: duplicated.project_id,
    campaignId: duplicated.campaign_id,
    videoJobId: duplicated.id,
    workflowTemplateId:
      typeof duplicated.metadata.workflowTemplateId === 'string'
        ? duplicated.metadata.workflowTemplateId
        : null,
    eventName: 'job_queued',
    jobKind: duplicated.job_kind,
    provider: duplicated.provider,
    units: 1,
    unitType: 'count',
    metadata: {
      retryCount: duplicated.retry_count ?? 0,
      source: 'video-jobs.duplicate',
    },
  })
  await recordUsageEvent({
    eventKey: `${duplicated.id}:rerun`,
    orgId: session.orgId,
    userId: session.userId,
    projectId: duplicated.project_id,
    campaignId: duplicated.campaign_id,
    videoJobId: duplicated.id,
    workflowTemplateId:
      typeof duplicated.metadata.workflowTemplateId === 'string'
        ? duplicated.metadata.workflowTemplateId
        : null,
    eventName: 'job_rerun',
    jobKind: duplicated.job_kind,
    provider: duplicated.provider,
    units: 1,
    unitType: 'count',
    metadata: {
      duplicatedFromVideoJobId: job.id,
      source: 'video-jobs.duplicate',
    },
  })

  await getQueueProvider().enqueue('video:jobs', {
    type: 'video-job.duplicate',
    id: duplicated.id,
    metadata: {
      orgId: session.orgId,
      duplicatedFromVideoJobId: job.id,
    },
  })

  return getVideoJobById(session, duplicated.id)
}

type FailureClassification = {
  failureStage: VideoJobFailureStage
  failureCode: VideoJobFailureCode
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  return ''
}

function classifyFailureFromMessage(
  message: string | null | undefined,
  fallbackStage: VideoJobFailureStage = 'unknown'
): FailureClassification {
  const normalized = (message || '').toLowerCase()

  if (!normalized) {
    return {
      failureStage: fallbackStage,
      failureCode: 'unknown_error' as const,
    }
  }

  if (normalized.includes('cancel')) {
    return {
      failureStage: fallbackStage === 'validation' ? 'provider_sync' : fallbackStage,
      failureCode: 'provider_cancelled' as const,
    }
  }

  if (
    normalized.includes('rate limit') ||
    normalized.includes('429') ||
    normalized.includes('concurrency limit')
  ) {
    return {
      failureStage: fallbackStage,
      failureCode: 'provider_rate_limited' as const,
    }
  }

  if (
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('auth') ||
    normalized.includes('api key')
  ) {
    return {
      failureStage: fallbackStage,
      failureCode: 'provider_auth_failed' as const,
    }
  }

  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('output_timeout')
  ) {
    return {
      failureStage: fallbackStage,
      failureCode: fallbackStage === 'provider_sync'
        ? 'provider_timeout'
        : 'underlying_generation_timeout',
    }
  }

  if (
    normalized.includes('unavailable') ||
    normalized.includes('503') ||
    normalized.includes('502') ||
    normalized.includes('connection refused') ||
    normalized.includes('econnrefused') ||
    normalized.includes('network')
  ) {
    return {
      failureStage: fallbackStage,
      failureCode: 'provider_unavailable' as const,
    }
  }

  if (
    normalized.includes('workflow not found') ||
    normalized.includes('mode mismatch') ||
    normalized.includes('invalid') ||
    normalized.includes('did not return job id') ||
    normalized.includes('missing prompt_id')
  ) {
    return {
      failureStage: fallbackStage,
      failureCode: 'provider_invalid_request' as const,
    }
  }

  if (normalized.includes('linked generation job could not be found')) {
    return {
      failureStage: 'provider_sync',
      failureCode: 'upstream_job_missing' as const,
    }
  }

  if (
    normalized.includes('upsert generated asset') ||
    normalized.includes('persist') ||
    normalized.includes('storage')
  ) {
    return {
      failureStage: fallbackStage === 'provider_sync' ? 'uploading' : fallbackStage,
      failureCode: 'asset_persistence_failed' as const,
    }
  }

  if (
    normalized.includes('download output failed') ||
    normalized.includes('failed to download runpod asset') ||
    normalized.includes('no outputs')
  ) {
    return {
      failureStage: 'uploading',
      failureCode: 'upstream_asset_missing' as const,
    }
  }

  if (normalized.includes('result') && normalized.includes('invalid')) {
    return {
      failureStage: 'provider_sync',
      failureCode: 'upstream_result_invalid' as const,
    }
  }

  return {
    failureStage: fallbackStage,
    failureCode:
      fallbackStage === 'provider_sync'
        ? 'upstream_job_terminal_failed'
        : 'underlying_generation_failed',
  }
}

export function classifyUnderlyingGenerationFailure(
  message: string | null | undefined
): VideoJobFailureCode {
  return classifyFailureFromMessage(message, 'provider_sync').failureCode
}

export function classifyVideoJobProcessingFailure(
  error: unknown,
  fallbackStage: VideoJobFailureStage = 'unknown'
): FailureClassification {
  const message = normalizeErrorMessage(error)

  if (message.toLowerCase().includes('workflow')) {
    return {
      failureStage: 'validation',
      failureCode: 'missing_workflow_template',
    }
  }

  if (message.toLowerCase().includes('influencer')) {
    return {
      failureStage: 'validation',
      failureCode: 'missing_influencer',
    }
  }

  if (message.toLowerCase().includes('requires workflowtemplateid and influencerid')) {
    return {
      failureStage: 'validation',
      failureCode: 'missing_required_context',
    }
  }

  return classifyFailureFromMessage(message, fallbackStage)
}

export function getVideoJobStuckState(job: Parameters<typeof deriveVideoJobDiagnostics>[0]) {
  return deriveVideoJobDiagnostics(job)
}
