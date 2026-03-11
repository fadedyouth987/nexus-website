import {
  ENGINE_MODEL_QUEUE,
  ENGINE_MODEL_REVIEW_JOB,
  enqueueEngineJob,
} from '../../../src/lib/engine/queue'
import { classifyModelStub } from '../../../src/lib/models/moderation'
import { getWorkerSupabaseAdmin } from '../core/supabaseAdmin'

type ModelRow = {
  id: string
  name: string
  file_path: string
  is_nsfw: boolean
  required_verification_level: number
  status: string
  meta_json: Record<string, unknown> | null
}

export async function processModelClassifierJob(modelId: string) {
  const admin = getWorkerSupabaseAdmin()
  const { data: model, error } = await admin
    .from('models')
    .select('id, name, file_path, is_nsfw, required_verification_level, status, meta_json')
    .eq('id', modelId)
    .maybeSingle()

  const typedModel = (model || null) as ModelRow | null

  if (error || !typedModel) {
    throw new Error(error?.message || `Model ${modelId} not found`)
  }

  const modelName = String(typedModel.name || '')
  const fileName = String(typedModel.file_path || '').split('/').pop() || 'model'
  const creatorMarkedNsfw = Boolean((typedModel.meta_json || {}).creator_marked_nsfw)
  const classifier = classifyModelStub({
    fileName,
    modelName,
    creatorMarkedNsfw,
  })

  const status = classifier.label === 'UNCERTAIN' ? 'REVIEW_REQUIRED' : typedModel.status
  const nextMeta = {
    ...(typedModel.meta_json || {}),
    classifier_async: {
      ...classifier,
      classified_at: new Date().toISOString(),
    },
  }

  await admin
    .from('models')
    .update({
      is_nsfw: classifier.isNsfw,
      required_verification_level: classifier.requiredVerificationLevel,
      status,
      meta_json: nextMeta,
    })
    .eq('id', typedModel.id)

  let reviewJobId: string | null = null
  if (classifier.label === 'UNCERTAIN' || classifier.label === 'NSFW-explicit') {
    reviewJobId = await enqueueEngineJob({
      queueName: ENGINE_MODEL_QUEUE,
      jobName: ENGINE_MODEL_REVIEW_JOB,
      payload: {
        kind: 'model_human_review',
        modelId: typedModel.id,
      },
    })
  }

  return {
    modelId: typedModel.id,
    classifier,
    reviewJobId,
  }
}
