import type { BlueprintJobRecord } from '../core/types'
import { getWorkerSupabaseAdmin } from '../core/supabaseAdmin'
import { comfyBaseUrl, connectProgressWs, downloadOutput, fetchHistory, submitPrompt } from '../core/comfyClient'
import { publishJobEvent } from '../core/redis'
import { outputKey } from '../core/storagePaths'
import { uploadObject } from '../core/storage'
import { resolveWorkflow } from '../core/workflow'
import { assertJobAllowed } from './policyEnforce'
import { mirrorAsset, mirrorJobStatus } from '../engines/mirror'
import { getBlueprintSignedGetUrl } from '../../../src/lib/blueprint/storageSign'
import { detectBackend } from '../../../src/lib/comfyui/generator'
import { downloadRunPodAsset, submitRunPodJob, waitForRunPodJob } from '../../../src/lib/comfyui/runpod'
import type { ComfyUIWorkflow } from '../../../src/lib/comfyui/types'

function normalizeComfyProgress(event: any) {
  if (event?.type === 'progress') {
    const value = Number(event?.data?.value || 0)
    const max = Number(event?.data?.max || 0)
    const percent = max > 0 ? Math.floor((value / max) * 100) : 0
    return { status: 'running', percent, node: event?.data?.node || null, message: 'Running' }
  }

  if (event?.type === 'executing') {
    return { status: 'running', percent: 1, node: event?.data?.node || null, message: 'Executing' }
  }

  return null
}

function extractOutputs(historyEntry: any) {
  const outputs: Array<{ filename: string; subfolder?: string; type?: string; kind: 'IMAGE' | 'VIDEO' }> = []
  if (!historyEntry?.outputs) return outputs

  for (const nodeId of Object.keys(historyEntry.outputs)) {
    const node = historyEntry.outputs[nodeId]
    for (const image of node?.images || []) {
      outputs.push({
        filename: image.filename,
        subfolder: image.subfolder,
        type: image.type,
        kind: 'IMAGE',
      })
    }
    for (const video of node?.videos || node?.gifs || []) {
      outputs.push({
        filename: video.filename,
        subfolder: video.subfolder,
        type: video.type,
        kind: 'VIDEO',
      })
    }
  }

  return outputs
}

async function waitForOutputs(baseUrl: string, promptId: string, mode: 'IMAGE' | 'VIDEO') {
  const timeoutMs = mode === 'VIDEO' ? 20 * 60_000 : 10 * 60_000
  const start = Date.now()

  while (Date.now() - start < timeoutMs) {
    const history = await fetchHistory(baseUrl, promptId)
    const outputs = extractOutputs(history?.[promptId])
    if (outputs.length > 0) {
      return outputs
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }

  throw new Error('OUTPUT_TIMEOUT')
}

type ResolvedOutput = {
  filename: string
  subfolder?: string
  type?: string
  kind: 'IMAGE' | 'VIDEO'
  download: () => Promise<Buffer>
}

async function runDirectComfyGeneration(
  baseUrl: string,
  job: BlueprintJobRecord,
  admin: any,
  promptId: string | null,
  resolvedWorkflow: ComfyUIWorkflow
) {
  const clientId = `worker-${job.id}`
  let resolvedPromptId = promptId

  if (!resolvedPromptId) {
    resolvedPromptId = await submitPrompt(baseUrl, resolvedWorkflow, clientId)
    await admin.from('generation_jobs').update({ prompt_id: resolvedPromptId }).eq('id', job.id)
  }

  const ws = connectProgressWs(baseUrl, clientId, async (event) => {
    const normalized = normalizeComfyProgress(event)
    if (!normalized) return

    await admin
      .from('generation_jobs')
      .update({
        progress_json: { ...normalized, updatedAt: new Date().toISOString() },
      })
      .eq('id', job.id)

    await publishJobEvent(job.id, { type: 'progress', ...normalized })
  })

  try {
    const outputs = await waitForOutputs(baseUrl, resolvedPromptId, job.mode)
    return {
      promptId: resolvedPromptId,
      outputs: outputs.map((output) => ({
        ...output,
        download: () =>
          downloadOutput(baseUrl, {
            filename: output.filename,
            subfolder: output.subfolder,
            type: output.type,
          }),
      })),
    }
  } finally {
    ws.close()
  }
}

async function runRunPodGeneration(
  job: BlueprintJobRecord,
  admin: any,
  promptId: string | null,
  resolvedWorkflow: ComfyUIWorkflow
) {
  let resolvedPromptId = promptId

  if (!resolvedPromptId) {
    const submitted = await submitRunPodJob(resolvedWorkflow, {
      idempotencyKey: job.id,
    })
    resolvedPromptId = submitted.jobId
    await admin.from('generation_jobs').update({ prompt_id: resolvedPromptId }).eq('id', job.id)
    await admin
      .from('generation_jobs')
      .update({
        progress_json: {
          status: 'running',
          percent: 5,
          message: submitted.status === 'IN_QUEUE' ? 'Queued on RunPod' : 'Started on RunPod',
          updatedAt: new Date().toISOString(),
        },
      })
      .eq('id', job.id)
    await publishJobEvent(job.id, {
      type: 'progress',
      status: 'running',
      percent: 5,
      message: submitted.status === 'IN_QUEUE' ? 'Queued on RunPod' : 'Started on RunPod',
    })
  }

  const jobResult = await waitForRunPodJob(resolvedPromptId, {
    timeoutMs: job.mode === 'VIDEO' ? 1_200_000 : 600_000,
    onProgress: async (status) => {
      const normalizedStatus = status === 'IN_QUEUE' ? 'queued' : 'running'
      const percent = status === 'COMPLETED' ? 100 : status === 'IN_PROGRESS' ? 60 : 10
      await admin
        .from('generation_jobs')
        .update({
          progress_json: {
            status: normalizedStatus,
            percent,
            message: `RunPod ${status.toLowerCase()}`,
            updatedAt: new Date().toISOString(),
          },
        })
        .eq('id', job.id)

      await publishJobEvent(job.id, {
        type: 'progress',
        status: normalizedStatus,
        percent,
        message: `RunPod ${status.toLowerCase()}`,
      })
    },
  })

  const outputs: ResolvedOutput[] = []

  for (const image of jobResult.output?.images || []) {
    outputs.push({
      filename: image.filename,
      type: image.type,
      kind: 'IMAGE',
      download: async () => Buffer.from(await downloadRunPodAsset(image.url)),
    })
  }

  for (const video of jobResult.output?.videos || []) {
    outputs.push({
      filename: video.filename,
      type: video.type,
      kind: 'VIDEO',
      download: async () => Buffer.from(await downloadRunPodAsset(video.url)),
    })
  }

  return {
    promptId: resolvedPromptId,
    outputs,
  }
}

async function upsertGeneratedAsset(admin: any, job: BlueprintJobRecord, asset: any) {
  const { data, error } = await admin
    .from('generated_assets')
    .upsert(asset, {
      onConflict: 'generation_job_id,kind,asset_variant',
    })
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to upsert generated asset')
  }

  await mirrorAsset(admin, job, data)
  return data
}

export async function processGeneration(jobId: string) {
  const admin = getWorkerSupabaseAdmin()

  const { data: job, error: jobError } = await admin
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single()

  if (jobError || !job) {
    throw new Error('JOB_NOT_FOUND')
  }
  if (job.status === 'READY') {
    return
  }

  const { data: user, error: uErr } = await admin
    .from('blueprint_users')
    .select('id, plan, plan_status, age_verified_at')
    .eq('id', job.user_id)
    .single()

  if (uErr || !user) {
    throw new Error('USER_NOT_FOUND')
  }

  assertJobAllowed(user, job)

  const { data: template } = await admin
    .from('workflow_templates')
    .select('*')
    .eq('id', job.workflow_template_id)
    .single()

  const { data: influencer } = await admin
    .from('influencers')
    .select('id, org_id, lora_model_path, reference_image_url, reference_image_storage_key')
    .eq('id', job.influencer_id)
    .single()

  if (!template || !influencer) {
    throw new Error('MISSING_REFS')
  }

  const finalInputs = { ...(job.inputs_json || {}) }

  // Auto-inject influencer identity for face lock: LoRA and/or reference image
  // Workflow templates must define variables_json.fields for lora_path and reference_image_url
  if (influencer.lora_model_path) {
    finalInputs.lora_path = influencer.lora_model_path
  }
  let refImageUrl = influencer.reference_image_url
  if (!refImageUrl && influencer.reference_image_storage_key) {
    try {
      const signed = await getBlueprintSignedGetUrl({
        key: influencer.reference_image_storage_key,
        isVault: job.content_policy === 'NSFW',
      })
      refImageUrl = signed.signedUrl
    } catch {
      // Skip ref image if signing fails (e.g. missing env)
    }
  }
  if (refImageUrl) {
    finalInputs.reference_image_url = refImageUrl
  }
  const resolvedWorkflow = resolveWorkflow(
    template.comfy_workflow_json || {},
    template.variables_json || {},
    finalInputs
  ) as ComfyUIWorkflow

  await admin
    .from('generation_jobs')
    .update({
      status: 'GENERATING',
      attempt: Number(job.attempt || 0) + 1,
      resolved_workflow_json: resolvedWorkflow,
      progress_json: {
        status: 'running',
        percent: 0,
        message: 'Starting',
        updatedAt: new Date().toISOString(),
      },
    })
    .eq('id', job.id)

  await publishJobEvent(job.id, { type: 'status', status: 'GENERATING', percent: 0 })

  let promptId = job.prompt_id as string | null
  const backend = detectBackend()

  try {
    const execution =
      backend === 'runpod'
        ? await runRunPodGeneration(job, admin, promptId, resolvedWorkflow)
        : await runDirectComfyGeneration(
            comfyBaseUrl(job.content_policy),
            job,
            admin,
            promptId,
            resolvedWorkflow
          )
    promptId = execution.promptId
    const isVault = job.content_policy === 'NSFW'

    for (const output of execution.outputs) {
      const buffer = await output.download()

      const key = outputKey({
        userId: job.user_id,
        jobId: job.id,
        filename: output.filename,
        isVault,
      })

      const storageKey = await uploadObject({
        key,
        body: buffer,
        contentType: output.kind === 'VIDEO' ? 'video/mp4' : 'image/png',
        isVault,
      })

      const persisted = await upsertGeneratedAsset(admin, job, {
        generation_job_id: job.id,
        organization_id: job.organization_id,
        influencer_id: job.influencer_id,
        kind: output.kind,
        asset_variant: 'main',
        visibility: isVault ? 'VAULT' : 'STANDARD',
        storage_url: storageKey,
        thumb_storage_url: output.kind === 'IMAGE' ? storageKey : null,
        mime_type: output.kind === 'VIDEO' ? 'video/mp4' : 'image/png',
        metadata_json: {
          comfy: {
            filename: output.filename,
            subfolder: output.subfolder || null,
            type: output.type || null,
          },
        },
      })

      await publishJobEvent(job.id, {
        type: 'asset_created',
        assetId: persisted.id,
        kind: persisted.kind,
        visibility: persisted.visibility,
      })
    }

    const { data: firstAsset } = await admin
      .from('generated_assets')
      .select('*')
      .eq('generation_job_id', job.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    await admin
      .from('generation_jobs')
      .update({
        status: 'READY',
        prompt_id: promptId,
        progress_json: {
          status: 'ready',
          percent: 100,
          message: 'Complete',
          updatedAt: new Date().toISOString(),
        },
        result_summary_json: firstAsset
          ? {
              asset_id: firstAsset.id,
              image_path: firstAsset.kind === 'IMAGE' ? firstAsset.storage_url : null,
              video_path: firstAsset.kind === 'VIDEO' ? firstAsset.storage_url : null,
            }
          : {},
      })
      .eq('id', job.id)

    await mirrorJobStatus(admin, {
      ...job,
      status: 'READY',
    })

    await publishJobEvent(job.id, { type: 'status', status: 'READY', percent: 100 })
  } catch (error) {
    await admin
      .from('generation_jobs')
      .update({
        status: 'FAILED',
        prompt_id: promptId,
        error: error instanceof Error ? error.message : 'Generation failed',
      })
      .eq('id', job.id)

    const { data: templateRow } = await admin
      .from('workflow_templates')
      .select('base_cost_credits')
      .eq('id', job.workflow_template_id)
      .maybeSingle()

    if (templateRow?.base_cost_credits) {
      await admin.from('credit_ledger').insert({
        user_id: job.user_id,
        delta: Number(templateRow.base_cost_credits),
        reason: 'RELEASE_RESERVE',
        ref_type: 'GenerationJob',
        ref_id: job.id,
      })
    }

    await mirrorJobStatus(admin, {
      ...job,
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Generation failed',
    })

    await publishJobEvent(job.id, {
      type: 'status',
      status: 'FAILED',
      message: error instanceof Error ? error.message : 'Generation failed',
    })

    throw error
  }
}
