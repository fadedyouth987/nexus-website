import { NextResponse } from 'next/server'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
export { GET } from '@/app/api/models/route'
import {
  ENGINE_MODEL_CLASSIFIER_JOB,
  ENGINE_MODEL_QUEUE,
  ENGINE_MODEL_REVIEW_JOB,
  ENGINE_MODEL_VALIDATION_JOB,
  enqueueEngineJob,
} from '@/lib/engine/queue'
import { getServerSupabase, requireUser } from '@/lib/server/v2Access'
import {
  ALLOWED_MODEL_EXTENSIONS,
  MAX_MODEL_UPLOAD_BYTES,
  MODEL_BUCKET_NSFW,
  MODEL_BUCKET_SFW,
  buildModelStoragePath,
  classifyModelStub,
  needsHumanReview,
  normalizeModelType,
  parseModelExtension,
  sanitizeModelName,
} from '@/lib/models/moderation'

function parseBoolean(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') return false
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function parseUploadLimit() {
  const raw = Number(process.env.MODEL_UPLOAD_MAX_BYTES || MAX_MODEL_UPLOAD_BYTES)
  return Number.isFinite(raw) && raw > 0 ? raw : MAX_MODEL_UPLOAD_BYTES
}

export async function POST(request: Request) {
  let uploadedPath: string | null = null
  let uploadedBucket: string | null = null
  let metadataInserted = false

  try {
    const user = await requireUser(request)
    const supabase = await getServerSupabase(request)
    const admin = getEngineSupabaseAdmin()

    const formData = await request.formData()
    const file = formData.get('file')
    const type = normalizeModelType(formData.get('type'))
    const rawName = typeof formData.get('name') === 'string' ? String(formData.get('name')) : ''
    const creatorMarkedNsfw = parseBoolean(formData.get('nsfw'))
    const modelName = sanitizeModelName(rawName)

    if (!(file instanceof File)) {
      return NextResponse.json({ detail: 'file is required' }, { status: 400 })
    }

    if (!modelName) {
      return NextResponse.json({ detail: 'name is required' }, { status: 400 })
    }

    const maxUploadBytes = parseUploadLimit()
    if (file.size > maxUploadBytes) {
      return NextResponse.json(
        { detail: `file exceeds upload limit (${maxUploadBytes} bytes)` },
        { status: 400 }
      )
    }

    const extension = parseModelExtension(file.name)
    if (!ALLOWED_MODEL_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { detail: 'file extension must be one of: .safetensors, .ckpt, .pt' },
        { status: 400 }
      )
    }

    const classifier = classifyModelStub({
      fileName: file.name,
      modelName,
      creatorMarkedNsfw,
    })
    const reviewRequired = needsHumanReview(classifier)

    const bucket = classifier.isNsfw ? MODEL_BUCKET_NSFW : MODEL_BUCKET_SFW
    const rootPrefix = classifier.isNsfw ? 'models-nsfw' : 'models'
    const path = buildModelStoragePath({
      rootPrefix,
      type,
      userId: user.userId,
      modelName,
      extension,
    })

    const binary = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await admin.storage.from(bucket).upload(path, binary, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })

    if (uploadError) {
      return NextResponse.json(
        { detail: uploadError.message || 'Failed to upload file' },
        { status: 500 }
      )
    }

    uploadedBucket = bucket
    uploadedPath = path

    const insertPayload = {
      user_id: user.userId,
      name: modelName,
      type,
      file_path: path,
      file_size: file.size,
      is_nsfw: classifier.isNsfw,
      required_verification_level: classifier.requiredVerificationLevel,
      status: reviewRequired ? 'REVIEW_REQUIRED' : 'QUEUED',
      meta_json: {
        classifier,
        creator_marked_nsfw: creatorMarkedNsfw,
        original_file_name: file.name,
        storage_bucket: bucket,
      },
    }

    const { data: insertedModel, error: insertError } = await supabase
      .from('models')
      .insert(insertPayload)
      .select(
        'id, name, type, file_path, file_size, is_nsfw, required_verification_level, status, meta_json, created_at'
      )
      .single()

    if (insertError || !insertedModel) {
      await admin.storage.from(bucket).remove([path])
      return NextResponse.json(
        { detail: insertError?.message || 'Failed to persist model metadata' },
        { status: 500 }
      )
    }
    metadataInserted = true

    const queueJobIds: Record<string, string> = {}

    try {
      const classifierJobId = await enqueueEngineJob({
        queueName: ENGINE_MODEL_QUEUE,
        jobName: ENGINE_MODEL_CLASSIFIER_JOB,
        payload: {
          kind: 'model_classifier',
          modelId: insertedModel.id,
        },
      })
      queueJobIds.classifier = classifierJobId

      if (reviewRequired) {
        const reviewJobId = await enqueueEngineJob({
          queueName: ENGINE_MODEL_QUEUE,
          jobName: ENGINE_MODEL_REVIEW_JOB,
          payload: {
            kind: 'model_human_review',
            modelId: insertedModel.id,
          },
        })
        queueJobIds.review = reviewJobId
      } else {
        const validationJobId = await enqueueEngineJob({
          queueName: ENGINE_MODEL_QUEUE,
          jobName: ENGINE_MODEL_VALIDATION_JOB,
          payload: {
            kind: 'model_validation',
            modelId: insertedModel.id,
          },
        })
        queueJobIds.validation = validationJobId
      }
    } catch (queueError) {
      await supabase
        .from('models')
        .update({
          status: 'FAILED',
          meta_json: {
            ...(insertedModel.meta_json as Record<string, unknown>),
            queue_error: queueError instanceof Error ? queueError.message : 'Failed to enqueue model job',
          },
        })
        .eq('id', insertedModel.id)

      return NextResponse.json(
        {
          detail: queueError instanceof Error ? queueError.message : 'Failed to enqueue model jobs',
        },
        { status: 500 }
      )
    }

    const mergedMeta = {
      ...(insertedModel.meta_json as Record<string, unknown>),
      queue_jobs: queueJobIds,
    }

    const { data: updatedModel } = await supabase
      .from('models')
      .update({ meta_json: mergedMeta })
      .eq('id', insertedModel.id)
      .select(
        'id, name, type, file_path, file_size, is_nsfw, required_verification_level, status, meta_json, created_at'
      )
      .single()

    return NextResponse.json(
      {
        model: updatedModel || insertedModel,
        classifier,
      },
      { status: 201 }
    )
  } catch (error) {
    if (!metadataInserted && uploadedBucket && uploadedPath) {
      try {
        const admin = getEngineSupabaseAdmin()
        await admin.storage.from(uploadedBucket).remove([uploadedPath])
      } catch {
        // best-effort cleanup
      }
    }

    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to upload model' },
      { status }
    )
  }
}
