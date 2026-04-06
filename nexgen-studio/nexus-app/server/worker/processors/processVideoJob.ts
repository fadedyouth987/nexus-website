import { getWorkerSupabaseAdmin } from '../core/supabaseAdmin'
import { logger } from '../core/logger'
import { createBlueprintGenerationJob } from '../../../src/lib/blueprint/createJob'
import { resolveGenerationRunTokenCost } from '../../../src/lib/billing/tokenCosts'
import { enqueueVideoJobRefresh } from '../core/videoJobQueue'
import { mapGenerationStatusToVideoLifecycle } from '../../../src/modules/video-jobs/mapper'
import { applyVideoJobLifecycleUpdate } from '../../../src/modules/video-jobs/repository'
import {
  classifyUnderlyingGenerationFailure,
  classifyVideoJobProcessingFailure,
} from '../../../src/modules/video-jobs/service'
import { recordUsageEvent } from '../../../src/modules/usage-events'
import type { VideoJobFailureCode, VideoJobFailureStage } from '../../../src/modules/video-jobs/types'

async function safeRecordUsageEvent(
  input: Parameters<typeof recordUsageEvent>[0]
) {
  try {
    await recordUsageEvent(input)
  } catch (error) {
    logger.error('Failed to record video job usage event', {
      videoJobId: input.videoJobId,
      eventName: input.eventName,
      error: error instanceof Error ? error.message : error,
    })
  }
}

async function failVideoJob(
  job: Record<string, unknown>,
  message: string,
  failureStage: VideoJobFailureStage,
  failureCode: VideoJobFailureCode
) {
  await applyVideoJobLifecycleUpdate(String(job.id), {
    status: 'failed',
    progress: 100,
    error_message: message,
    failure_stage: failureStage,
    failure_code: failureCode,
    heartbeat: true,
  })
  await safeRecordUsageEvent({
    eventKey: `${String(job.id)}:attempt:${Number(job.retry_count || 0)}:job_failed`,
    orgId: String(job.org_id),
    userId: typeof job.created_by === 'string' ? job.created_by : null,
    projectId: typeof job.project_id === 'string' ? job.project_id : null,
    campaignId: typeof job.campaign_id === 'string' ? job.campaign_id : null,
    videoJobId: String(job.id),
    generationJobId: typeof job.source_generation_job_id === 'string' ? job.source_generation_job_id : null,
    workflowTemplateId:
      job.metadata && typeof job.metadata === 'object' && typeof (job.metadata as Record<string, unknown>).workflowTemplateId === 'string'
        ? (job.metadata as Record<string, unknown>).workflowTemplateId as string
        : null,
    eventName: 'job_failed',
    jobKind: job.job_kind === 'image' ? 'image' : 'video',
    provider: typeof job.provider === 'string' ? job.provider : null,
    units: 1,
    unitType: 'count',
    metadata: {
      failureStage,
      failureCode,
      source: 'video-job.worker',
    },
  })
}

async function isVideoJobCancelled(supabase: ReturnType<typeof getWorkerSupabaseAdmin>, videoJobId: string) {
  const { data, error } = await supabase
    .from('video_jobs')
    .select('status')
    .eq('id', videoJobId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data?.status === 'cancelled'
}

async function cancelLinkedGenerationJob(
  supabase: ReturnType<typeof getWorkerSupabaseAdmin>,
  generationJobId: string,
  message: string
) {
  const { error } = await supabase
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

  if (error) {
    throw error
  }
}

export async function processVideoJob(videoJobId: string) {
  const supabase = getWorkerSupabaseAdmin()

  const { data: job, error } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('id', videoJobId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!job) {
    throw new Error(`Video job not found: ${videoJobId}`)
  }

  if (job.status === 'cancelled') {
    if (job.source_generation_job_id) {
      await cancelLinkedGenerationJob(supabase, job.source_generation_job_id, 'Cancelled by user.')
    }
    logger.info('Skipping cancelled video job', { videoJobId })
    return
  }

  await applyVideoJobLifecycleUpdate(videoJobId, { heartbeat: true })

  if (job.source_generation_job_id) {
    if (await isVideoJobCancelled(supabase, videoJobId)) {
      await cancelLinkedGenerationJob(supabase, job.source_generation_job_id, 'Cancelled by user.')
      logger.info('Video job cancelled before linked generation refresh', {
        videoJobId,
        generationJobId: job.source_generation_job_id,
      })
      return
    }

    const { data: generationJob, error: generationError } = await supabase
      .from('generation_jobs')
      .select('id, status, prompt_id, progress_json, error')
      .eq('id', job.source_generation_job_id)
      .maybeSingle()

    if (generationError) {
      throw generationError
    }

    if (!generationJob) {
      await failVideoJob(
        job as Record<string, unknown>,
        'Linked generation job could not be found.',
        'provider_sync',
        'upstream_job_missing'
      )
      return
    }

    const lifecycle = mapGenerationStatusToVideoLifecycle(generationJob.status)
    const progressJson =
      generationJob.progress_json && typeof generationJob.progress_json === 'object'
        ? generationJob.progress_json as Record<string, unknown>
        : null
    const progress =
      progressJson && typeof progressJson.percent === 'number'
        ? progressJson.percent
        : lifecycle.progress

    await applyVideoJobLifecycleUpdate(videoJobId, {
      status: lifecycle.status,
      progress,
      provider_job_id: typeof generationJob.prompt_id === 'string' ? generationJob.prompt_id : null,
      error_message:
        typeof generationJob.error === 'string'
          ? generationJob.error
          : lifecycle.status === 'cancelled'
            ? 'Upstream generation was cancelled.'
            : null,
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

    if (generationJob.status === 'READY') {
      logger.info('Video job completed from linked generation job', {
        videoJobId,
        generationJobId: generationJob.id,
      })
      return
    }

    if (generationJob.status === 'FAILED') {
      logger.warn('Video job failed from linked generation job', {
        videoJobId,
        generationJobId: generationJob.id,
      })
      return
    }

    if (generationJob.status === 'CANCELED') {
      logger.info('Video job cancelled from linked generation job', {
        videoJobId,
        generationJobId: generationJob.id,
      })
      return
    }

    if (await isVideoJobCancelled(supabase, videoJobId)) {
      await cancelLinkedGenerationJob(supabase, job.source_generation_job_id, 'Cancelled by user.')
      logger.info('Video job cancelled while linked generation was still active', {
        videoJobId,
        generationJobId: job.source_generation_job_id,
      })
      return
    }

    await enqueueVideoJobRefresh(videoJobId, 5000)
    logger.info('Video job linked generation still running', {
      videoJobId,
      generationJobId: generationJob.id,
    })
    return
  }

  const metadata = job.metadata && typeof job.metadata === 'object'
    ? job.metadata as Record<string, unknown>
    : {}
  const workflowTemplateId =
    typeof metadata.workflowTemplateId === 'string' ? metadata.workflowTemplateId : null
  const influencerId =
    typeof metadata.influencerId === 'string' ? metadata.influencerId : null
  const inputs =
    metadata.inputs && typeof metadata.inputs === 'object'
      ? metadata.inputs as Record<string, unknown>
      : {}

  const [{ data: campaign }, { data: project }, { data: brandKit }, { data: blueprintUser }, { data: workflowTemplate }] = await Promise.all([
    job.campaign_id
      ? supabase.from('campaigns').select('id, name, brief').eq('id', job.campaign_id).maybeSingle()
      : Promise.resolve({ data: null }),
    job.project_id
      ? supabase.from('projects').select('id, name, objective').eq('id', job.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    job.brand_kit_id
      ? supabase.from('brand_kits').select('id, name, tone, voice_guidelines').eq('id', job.brand_kit_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('blueprint_users')
      .select('plan, plan_status, age_verified_at')
      .eq('id', job.created_by)
      .maybeSingle(),
    workflowTemplateId
      ? supabase.from('workflow_templates').select('id, base_cost_credits').eq('id', workflowTemplateId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!workflowTemplateId || !influencerId) {
    await failVideoJob(
      job as Record<string, unknown>,
      'Video job requires workflowTemplateId and influencerId metadata for generation.',
      'validation',
      'missing_required_context'
    )
    logger.warn('Video job failed due to missing generation wiring', { videoJobId })
    return
  }

  if (!blueprintUser) {
    await failVideoJob(
      job as Record<string, unknown>,
      'Blueprint user record is missing for this job owner.',
      'validation',
      'missing_required_context'
    )
    return
  }

  const composedPrompt = [
    typeof inputs.prompt === 'string' ? inputs.prompt : '',
    job.brief,
    campaign?.brief ?? '',
    brandKit?.voice_guidelines ?? '',
    brandKit?.tone ?? '',
    project?.objective ?? '',
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    await applyVideoJobLifecycleUpdate(videoJobId, {
      status: 'planning',
      progress: 12,
      error_message: null,
      failure_stage: null,
      failure_code: null,
      heartbeat: true,
    })

    if (await isVideoJobCancelled(supabase, videoJobId)) {
      logger.info('Video job cancelled before generation backbone submission', { videoJobId })
      return
    }

    const generationJob = await createBlueprintGenerationJob({
      userId: job.created_by,
      profile: blueprintUser,
      influencerId,
      workflowTemplateId,
      mode: job.job_kind === 'image' ? 'IMAGE' : 'VIDEO',
      inputs: {
        ...inputs,
        prompt: composedPrompt,
        script: job.script,
        project_name: project?.name ?? null,
        campaign_name: campaign?.name ?? null,
        brand_kit_name: brandKit?.name ?? null,
      },
    })

    if (await isVideoJobCancelled(supabase, videoJobId)) {
      await cancelLinkedGenerationJob(supabase, generationJob.id, 'Cancelled by user.')
      logger.info('Video job cancelled after generation backbone submission', {
        videoJobId,
        generationJobId: generationJob.id,
      })
      return
    }

    await applyVideoJobLifecycleUpdate(videoJobId, {
      source_generation_job_id: generationJob.id,
      provider_job_id: generationJob.prompt_id ?? null,
      status: 'queued',
      progress: 18,
      metadata: {
        ...metadata,
        generationJobId: generationJob.id,
      },
      heartbeat: true,
    })
    const reservedCredits = resolveGenerationRunTokenCost({
      type: job.job_kind === 'image' ? 'IMAGE' : 'VIDEO',
      templateBaseCostCredits: Number(workflowTemplate?.base_cost_credits ?? 0) || null,
    })
    await safeRecordUsageEvent({
      eventKey: `${job.id}:attempt:${Number(job.retry_count || 0)}:credits_reserved`,
      orgId: String(job.org_id),
      userId: typeof job.created_by === 'string' ? job.created_by : null,
      projectId: typeof job.project_id === 'string' ? job.project_id : null,
      campaignId: typeof job.campaign_id === 'string' ? job.campaign_id : null,
      videoJobId: String(job.id),
      generationJobId: generationJob.id,
      workflowTemplateId,
      eventName: 'credits_reserved',
      jobKind: job.job_kind === 'image' ? 'image' : 'video',
      provider: typeof job.provider === 'string' ? job.provider : null,
      units: reservedCredits,
      unitType: 'credits',
      metadata: {
        retryCount: Number(job.retry_count || 0),
        source: 'video-job.worker',
      },
    })

    await enqueueVideoJobRefresh(videoJobId, 5000)

    logger.info('Video job linked to generation backbone', {
      videoJobId,
      generationJobId: generationJob.id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Video job planning failed'
    const fallbackStage =
      typeof (error as { failureStage?: string }).failureStage === 'string'
        ? (error as { failureStage: VideoJobFailureStage }).failureStage
        : 'planning'
    const classification = classifyVideoJobProcessingFailure(error, fallbackStage)

    await failVideoJob(
      job as Record<string, unknown>,
      message,
      classification.failureStage,
      classification.failureCode
    )
    throw error
  }
}
