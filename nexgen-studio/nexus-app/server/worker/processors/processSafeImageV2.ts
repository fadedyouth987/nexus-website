import {
  comfyuiDownloadOutput,
  comfyuiPoll,
  comfyuiResolveFirstImageOutput,
  comfyuiSubmit,
} from '../../../src/lib/server/comfyui'
import { writeActivityLog } from '../../../src/lib/server/activityLog'
import { getWorkerSupabaseAdmin } from '../core/supabaseAdmin'
import { buildSafeImageWorkflow, SAFE_IMAGE_WORKFLOW_PRESET } from '../core/safeImageWorkflow'

type SafeImageJobPayload = {
  kind: 'content_v2_safe_image'
  org_id: string
  workspace_id: string
  content_id: string
  prompt: string
  requested_at?: string
  requested_by?: string | null
}

type ContentRow = {
  id: string
  org_id: string
  workspace_id: string
  type: string
  data: unknown
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) }
  }
  return {}
}

function getGeneratedImageMeta(data: unknown) {
  const root = toRecord(data)
  const generated = toRecord(root.generated)
  return toRecord(generated.image)
}

function mergeGeneratedImageMeta(data: unknown, patch: Record<string, unknown>) {
  const root = toRecord(data)
  const generated = toRecord(root.generated)
  const image = toRecord(generated.image)
  generated.image = {
    ...image,
    ...patch,
  }
  root.generated = generated
  return root
}

function fileExtension(filename: string) {
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex === -1 || dotIndex === filename.length - 1) {
    return 'png'
  }
  const ext = filename.slice(dotIndex + 1).toLowerCase()
  return ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'png'
}

function contentTypeFromExtension(ext: string) {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  return 'image/png'
}

function resolveSeed(existingMeta: Record<string, unknown>) {
  const existingSeed = Number(existingMeta.seed)
  if (Number.isFinite(existingSeed) && existingSeed >= 0) {
    return Math.floor(existingSeed)
  }
  return Math.floor(Math.random() * 2_147_483_647)
}

async function loadContent(admin: any, payload: SafeImageJobPayload): Promise<ContentRow> {
  const { data, error } = await admin
    .from('content_v2')
    .select('id, org_id, workspace_id, type, data')
    .eq('id', payload.content_id)
    .eq('org_id', payload.org_id)
    .eq('workspace_id', payload.workspace_id)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load content_v2 row: ${error.message}`)
  }

  if (!data) {
    throw new Error(`content_v2 row not found for content_id ${payload.content_id}`)
  }

  return data as ContentRow
}

async function updateContentData(admin: any, row: ContentRow, nextData: Record<string, unknown>) {
  const { error } = await admin
    .from('content_v2')
    .update({
      data: nextData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .eq('org_id', row.org_id)
    .eq('workspace_id', row.workspace_id)

  if (error) {
    throw new Error(`Failed to update content_v2.data: ${error.message}`)
  }
}

export async function processSafeImageV2Job(payload: SafeImageJobPayload) {
  const admin = getWorkerSupabaseAdmin()
  let row: ContentRow | null = null
  let promptId: string | null = null

  try {
    row = await loadContent(admin, payload)

    if (row.type !== 'image') {
      throw new Error(`Safe-image worker only supports image content (received ${row.type})`)
    }

    const generatedMeta = getGeneratedImageMeta(row.data)
    const existingUrl =
      typeof generatedMeta.url === 'string' && generatedMeta.url.trim() ? generatedMeta.url.trim() : null

    if (existingUrl) {
      console.log(`[worker:generation-safe-image] content ${row.id} already generated, skipping`)
      return {
        skipped: true,
        reason: 'already_generated',
        content_id: row.id,
        url: existingUrl,
      }
    }

    const rowData = toRecord(row.data)
    const rowPrompt =
      typeof rowData.prompt === 'string' && rowData.prompt.trim() ? rowData.prompt.trim() : ''
    const prompt = payload.prompt?.trim() || rowPrompt
    if (!prompt) {
      throw new Error(`Prompt is required for content ${row.id}`)
    }

    promptId =
      typeof generatedMeta.prompt_id === 'string' && generatedMeta.prompt_id.trim()
        ? generatedMeta.prompt_id.trim()
        : null
    const seed = resolveSeed(generatedMeta)
    const nowIso = new Date().toISOString()

    if (!promptId) {
      const workflow = buildSafeImageWorkflow({ prompt, seed })
      const submitResult = await comfyuiSubmit(workflow)
      promptId = submitResult.prompt_id

      await updateContentData(
        admin,
        row,
        mergeGeneratedImageMeta(row.data, {
          prompt_id: promptId,
          prompt,
          seed,
          status: 'submitted',
          requested_at: payload.requested_at || nowIso,
          requested_by: payload.requested_by || null,
          workflow_preset: SAFE_IMAGE_WORKFLOW_PRESET,
          error: null,
        })
      )
    }

    console.log(`[worker:generation-safe-image] polling prompt_id=${promptId} for content=${row.id}`)
    const history = await comfyuiPoll(promptId)
    const outputFile = comfyuiResolveFirstImageOutput(history)
    if (!outputFile) {
      throw new Error(`No image output found in ComfyUI history for prompt_id ${promptId}`)
    }

    const fileBytes = await comfyuiDownloadOutput(outputFile)
    const extension = fileExtension(outputFile.filename)
    const bucket = (process.env.V2_GENERATED_BUCKET || process.env.SUPABASE_GENERATED_BUCKET || 'generated').trim()
    const storagePath = `v2/${row.org_id}/${row.workspace_id}/${row.id}/generated/${promptId}.${extension}`

    const { error: uploadError } = await admin.storage.from(bucket).upload(storagePath, fileBytes, {
      upsert: true,
      contentType: contentTypeFromExtension(extension),
    })

    if (uploadError) {
      throw new Error(`Supabase Storage upload failed: ${uploadError.message}`)
    }

    const { data: publicUrlData } = admin.storage.from(bucket).getPublicUrl(storagePath)
    const publicUrl =
      publicUrlData && typeof publicUrlData.publicUrl === 'string' ? publicUrlData.publicUrl : ''

    if (!publicUrl) {
      throw new Error('Failed to resolve public URL for generated image')
    }

    const completedAt = new Date().toISOString()
    const nextData = mergeGeneratedImageMeta(row.data, {
      url: publicUrl,
      bucket,
      storage_path: storagePath,
      source_filename: outputFile.filename,
      prompt,
      prompt_id: promptId,
      seed,
      status: 'completed',
      workflow_preset: SAFE_IMAGE_WORKFLOW_PRESET,
      created_at: completedAt,
      error: null,
    })

    await updateContentData(admin, row, nextData)

    await writeActivityLog({
      supabase: admin,
      orgId: row.org_id,
      workspaceId: row.workspace_id,
      actorId: payload.requested_by || null,
      action: 'generation.safe_image.succeeded',
      entityType: 'content',
      entityId: row.id,
      metadata: {
        prompt_id: promptId,
        workflow_preset: SAFE_IMAGE_WORKFLOW_PRESET,
        bucket,
        storage_path: storagePath,
      },
    })

    console.log(
      `[worker:generation-safe-image] uploaded content=${row.id} prompt_id=${promptId} path=${storagePath}`
    )

    return {
      ok: true,
      content_id: row.id,
      prompt_id: promptId,
      url: publicUrl,
      storage_path: storagePath,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Safe-image generation failed'
    if (row) {
      try {
        const erroredData = mergeGeneratedImageMeta(row.data, {
          prompt_id: promptId,
          status: 'failed',
          error: message,
          failed_at: new Date().toISOString(),
          workflow_preset: SAFE_IMAGE_WORKFLOW_PRESET,
        })
        await updateContentData(admin, row, erroredData)
      } catch (updateError) {
        console.error('[worker:generation-safe-image] failed to persist error state', updateError)
      }

      await writeActivityLog({
        supabase: admin,
        orgId: row.org_id,
        workspaceId: row.workspace_id,
        actorId: payload.requested_by || null,
        action: 'generation.safe_image.failed',
        entityType: 'content',
        entityId: row.id,
        metadata: {
          prompt_id: promptId,
          error: message,
          workflow_preset: SAFE_IMAGE_WORKFLOW_PRESET,
        },
      })
    }

    throw error
  }
}

export type { SafeImageJobPayload }
