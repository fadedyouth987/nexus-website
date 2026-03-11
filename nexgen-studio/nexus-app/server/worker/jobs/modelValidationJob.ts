import { comfyBaseUrl } from '../core/comfyClient'
import { getWorkerSupabaseAdmin } from '../core/supabaseAdmin'
import { MODEL_BUCKET_NSFW, MODEL_BUCKET_SFW } from '../../../src/lib/models/moderation'
import { runModelValidationOnRunpod } from '../runpod/orchestrator'

type ModelRow = {
  id: string
  user_id: string
  name: string
  type: string
  file_path: string
  is_nsfw: boolean
  status: string
  meta_json: Record<string, unknown> | null
}

function safeComfyEndpoint(isNsfw: boolean) {
  try {
    return comfyBaseUrl(isNsfw ? 'NSFW' : 'SFW')
  } catch {
    return null
  }
}

function resolveBucket(model: ModelRow) {
  const meta = model.meta_json || {}
  if (typeof meta.storage_bucket === 'string' && meta.storage_bucket) {
    return meta.storage_bucket
  }
  return model.is_nsfw ? MODEL_BUCKET_NSFW : MODEL_BUCKET_SFW
}

export async function processModelValidationJob(
  modelId: string,
  opts: { preReservedCredits?: number } = {}
) {
  const admin = getWorkerSupabaseAdmin()
  const { data: model, error } = await admin
    .from('models')
    .select('id, user_id, name, type, file_path, is_nsfw, status, meta_json')
    .eq('id', modelId)
    .maybeSingle()

  const typedModel = (model || null) as ModelRow | null

  if (error || !typedModel) {
    throw new Error(error?.message || `Model ${modelId} not found`)
  }

  const { data: activeGpuJob } = await admin
    .from('model_gpu_jobs')
    .select('id')
    .eq('model_id', typedModel.id)
    .in('status', ['QUEUED', 'RUNNING'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const activeGpuJobId = typeof activeGpuJob?.id === 'string' ? activeGpuJob.id : null

  const bucket = resolveBucket(typedModel)
  const { data: signed, error: signError } = await admin.storage.from(bucket).createSignedUrl(typedModel.file_path, 600)
  if (signError || !signed?.signedUrl) {
    throw new Error(signError?.message || `Failed to sign model ${typedModel.id}`)
  }

  await admin
    .from('models')
    .update({
      status: 'VALIDATING',
      meta_json: {
        ...(typedModel.meta_json || {}),
        validation: {
          started_at: new Date().toISOString(),
          provider: 'runpod',
        },
      },
    })
    .eq('id', typedModel.id)

  if (activeGpuJobId) {
    await admin
      .from('model_gpu_jobs')
      .update({
        status: 'RUNNING',
      })
      .eq('id', activeGpuJobId)
  }

  try {
    const result = await runModelValidationOnRunpod({
      jobId: `model-${typedModel.id}`,
      modelId: typedModel.id,
      userId: typedModel.user_id,
      modelSignedUrl: signed.signedUrl,
      comfyEndpoint: safeComfyEndpoint(typedModel.is_nsfw),
      preReservedCredits: opts.preReservedCredits,
    })

    const nextStatus = result.status === 'COMPLETED' ? 'READY' : 'FAILED'
    await admin
      .from('models')
      .update({
        status: nextStatus,
        meta_json: {
          ...(typedModel.meta_json || {}),
          validation: {
            provider: 'runpod',
            completed_at: new Date().toISOString(),
            runpod_pod_id: result.podId,
            runpod_status: result.status,
            output_path: result.outputPath,
            logs: result.logs.slice(-20),
          },
        },
      })
      .eq('id', typedModel.id)

    if (activeGpuJobId) {
      await admin
        .from('model_gpu_jobs')
        .update({
          status: nextStatus,
          actual_credits: result.actualCredits || null,
          runtime_seconds: result.runtimeSeconds || null,
          metadata_json: {
            runpod_pod_id: result.podId,
            runpod_status: result.status,
            output_path: result.outputPath,
          },
        })
        .eq('id', activeGpuJobId)
    }

    return {
      modelId: typedModel.id,
      status: nextStatus,
      runpod: result,
    }
  } catch (runError) {
    const blockedByCredits = (runError as { status?: number }).status === 402
    await admin
      .from('models')
      .update({
        status: blockedByCredits ? 'BLOCKED' : 'FAILED',
        meta_json: {
          ...(typedModel.meta_json || {}),
          validation: {
            provider: 'runpod',
            failed_at: new Date().toISOString(),
            blocked_by_credits: blockedByCredits,
            error: runError instanceof Error ? runError.message : 'validation failed',
          },
        },
      })
      .eq('id', typedModel.id)

    if (activeGpuJobId) {
      await admin
        .from('model_gpu_jobs')
        .update({
          status: blockedByCredits ? 'BLOCKED' : 'FAILED',
          error: runError instanceof Error ? runError.message : 'validation failed',
        })
        .eq('id', activeGpuJobId)
    }
    throw runError
  }
}
