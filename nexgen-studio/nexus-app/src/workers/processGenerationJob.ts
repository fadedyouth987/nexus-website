import { createServiceClient } from '@/lib/supabase/service'
import {
  buildWorkflowFromJobParams,
  getImageBuffer,
  queuePrompt,
  waitForCompletion,
} from '@/lib/ai/comfyui'
import { uploadToStorage } from '@/lib/storage'
import { publishJobUpdate } from '@/lib/ws/jobBroadcast'
import {
  GENERATION_PROVIDER_COMFY,
  GENERATION_WORKFLOW,
  logGenerationFailure,
} from '@/lib/logging/generationFailure'

const PLACEHOLDER_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

export type JobAttemptMeta = {
  attemptsMade: number
  maxAttempts: number
}

const OOM_RE = /out of memory|CUDA out of memory|OOM/i

export async function processGenerationJob(jobId: string, meta?: JobAttemptMeta): Promise<void> {
  const service = createServiceClient()
  const attemptsMade = meta?.attemptsMade ?? 0
  const maxAttempts = Math.max(1, meta?.maxAttempts ?? 3)
  const attemptNumber = attemptsMade + 1
  const isFirstAttempt = attemptsMade === 0
  const startedAt = new Date()

  await service
    .from('generation_jobs')
    .update({
      status: 'processing',
      ...(isFirstAttempt ? { started_at: startedAt.toISOString() } : {}),
      retry_count: attemptsMade,
      progress: 5,
      error_message: null,
    })
    .eq('id', jobId)

  await publishJobUpdate(jobId, {
    type: 'started',
    progress: 5,
    message: `Starting generation… (attempt ${attemptNumber}/${maxAttempts})`,
  })

  const { data: job, error: jobError } = await service.from('generation_jobs').select('*').eq('id', jobId).single()

  if (jobError || !job) {
    logGenerationFailure({
      jobId,
      workflow: GENERATION_WORKFLOW,
      provider: GENERATION_PROVIDER_COMFY,
      code: 'JOB_NOT_FOUND',
      message: jobError?.message ?? 'Job row missing',
    })
    await publishJobUpdate(jobId, { type: 'error', message: 'Job not found' })
    return
  }

  const params = job.input_params as Record<string, unknown>
  const width = typeof params.width === 'number' ? params.width : 512
  const height = typeof params.height === 'number' ? params.height : 512
  const positive = typeof params.positive === 'string' ? params.positive : undefined
  const modelUsed = typeof params.model === 'string' ? params.model : 'sd15'

  const outputUrls: string[] = []

  try {
    const workflow = buildWorkflowFromJobParams(job.input_params)
    const promptId = await queuePrompt(workflow, jobId)

    await service.from('generation_jobs').update({ comfyui_prompt_id: promptId, progress: 10 }).eq('id', jobId)
    await publishJobUpdate(jobId, { type: 'queued', progress: 10, message: 'Queued in ComfyUI' })

    const timeout = Number(process.env.COMFYUI_JOB_TIMEOUT_MS || 300_000)
    const result = await waitForCompletion(
      promptId,
      timeout,
      (progress, message) => {
        void publishJobUpdate(jobId, { type: 'progress', progress, message })
      }
    )

    let idx = 0
    for (const img of result.outputs) {
      const buf = await getImageBuffer(img.filename, img.subfolder || '', img.type || 'output')
      const key = `generations/${job.org_id}/${jobId}/${img.filename}`
      const url = await uploadToStorage(buf, key, 'image/png')
      outputUrls.push(url)

      await service.from('generated_assets').insert({
        org_id: job.org_id,
        user_id: job.user_id,
        job_id: jobId,
        url,
        file_type: 'image',
        width,
        height,
        prompt: positive ?? null,
        negative_prompt: typeof params.negative === 'string' ? params.negative : null,
        seed: typeof params.seed === 'number' ? params.seed : null,
        model_used: modelUsed,
        generation_params: params,
      })

      idx += 1
      await publishJobUpdate(jobId, {
        type: 'progress',
        progress: 90 + Math.floor((idx / Math.max(1, result.outputs.length)) * 8),
        message: `Uploaded ${idx}/${result.outputs.length}`,
      })
    }

    if (outputUrls.length === 0) {
      const url = await uploadToStorage(PLACEHOLDER_PNG, `generations/${job.org_id}/${jobId}/placeholder.png`, 'image/png')
      outputUrls.push(url)
      await service.from('generated_assets').insert({
        org_id: job.org_id,
        user_id: job.user_id,
        job_id: jobId,
        url,
        file_type: 'image',
        width,
        height,
        prompt: positive ?? null,
        model_used: modelUsed,
        generation_params: params,
      })
    }

    const completedAt = new Date()
    await service
      .from('generation_jobs')
      .update({
        status: 'completed',
        completed_at: completedAt.toISOString(),
        processing_time_ms: completedAt.getTime() - startedAt.getTime(),
        output_images: outputUrls,
        progress: 100,
        error_message: null,
      })
      .eq('id', jobId)

    await publishJobUpdate(jobId, {
      type: 'complete',
      progress: 100,
      message: 'Generation complete',
      images: outputUrls,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)

    const fatalOom = OOM_RE.test(message)
    const willRetry = !fatalOom && attemptNumber < maxAttempts

    logGenerationFailure({
      userId: job.user_id,
      resolvedOrgId: job.org_id,
      jobId,
      workflow: GENERATION_WORKFLOW,
      provider: GENERATION_PROVIDER_COMFY,
      code: willRetry ? 'COMFY_PIPELINE_RETRY' : 'COMFY_PIPELINE_FAILED',
      message,
      attempt: attemptNumber,
      maxAttempts,
    })

    if (willRetry) {
      await service
        .from('generation_jobs')
        .update({
          status: 'queued',
          retry_count: attemptNumber,
          error_message: message,
          progress: 0,
        })
        .eq('id', jobId)

      await publishJobUpdate(jobId, {
        type: 'progress',
        progress: 0,
        message: `Retry scheduled (${attemptNumber}/${maxAttempts}): ${message}`,
      })
      throw e
    }

    try {
      const url = await uploadToStorage(
        PLACEHOLDER_PNG,
        `generations/${job.org_id}/${jobId}/error-fallback.png`,
        'image/png'
      )
      outputUrls.push(url)
      await service.from('generated_assets').insert({
        org_id: job.org_id,
        user_id: job.user_id,
        job_id: jobId,
        url,
        file_type: 'image',
        width,
        height,
        prompt: positive ?? null,
        model_used: modelUsed,
        generation_params: params,
      })
    } catch {
      // ignore storage errors in failure path
    }

    const completedAt = new Date()
    await service
      .from('generation_jobs')
      .update({
        status: 'failed',
        completed_at: completedAt.toISOString(),
        processing_time_ms: completedAt.getTime() - startedAt.getTime(),
        error_message: message,
        output_images: outputUrls,
        progress: 100,
        retry_count: attemptsMade,
      })
      .eq('id', jobId)

    await publishJobUpdate(jobId, { type: 'error', message })
  }
}
