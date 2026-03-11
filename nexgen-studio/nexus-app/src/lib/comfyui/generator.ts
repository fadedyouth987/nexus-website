/**
 * Unified generation service that supports both:
 * - Direct ComfyUI Headless (self-hosted or RunPod container)
 * - RunPod Serverless API
 *
 * Automatically selects backend based on environment variables:
 * - If RUNPOD_API_KEY and RUNPOD_ENDPOINT_ID are set → Use RunPod Serverless
 * - Otherwise → Use direct ComfyUI via COMFYUI_BASE_URL
 */

import type { ComfyUIWorkflow, ComfyUIOutputAsset } from './types'
import {
  submitWorkflow,
  waitForJob,
  getOutputAssetsFromHistory,
  downloadAllAssets,
} from './client'
import {
  submitRunPodJob,
  waitForRunPodJob,
  downloadRunPodAsset,
  convertRunPodOutputToAssets,
} from './runpod'

export type GenerationBackend = 'comfyui' | 'runpod'

export interface GenerationOptions {
  pollIntervalMs?: number
  timeoutMs?: number
  onProgress?: (message: string) => void
  webhook?: string
  idempotencyKey?: string
  contentRating?: 'sfw' | 'nsfw'
}

export interface GenerationResult {
  jobId: string
  backend: GenerationBackend
  assets: Array<{
    filename: string
    buffer: ArrayBuffer
    kind: 'image' | 'video'
  }>
}

/**
 * Detect which generation backend to use based on environment variables.
 */
export function detectBackend(): GenerationBackend {
  if (process.env.RUNPOD_API_KEY && process.env.RUNPOD_ENDPOINT_ID) {
    return 'runpod'
  }
  return 'comfyui'
}

/**
 * Generate content using the configured backend.
 * Automatically selects between ComfyUI and RunPod based on env vars.
 */
export async function generate(
  workflow: ComfyUIWorkflow,
  options?: GenerationOptions
): Promise<GenerationResult> {
  const backend = detectBackend()

  if (backend === 'runpod') {
    return generateWithRunPod(workflow, options)
  }

  return generateWithComfyUI(workflow, options)
}

/**
 * Generate using direct ComfyUI connection.
 * Routes to COMFY_NSFW_URL when contentRating is 'nsfw'.
 */
async function generateWithComfyUI(
  workflow: ComfyUIWorkflow,
  options?: GenerationOptions
): Promise<GenerationResult> {
  const originalBaseUrl = process.env.COMFYUI_BASE_URL
  if (options?.contentRating === 'nsfw' && process.env.COMFY_NSFW_URL) {
    process.env.COMFYUI_BASE_URL = process.env.COMFY_NSFW_URL
  } else if (options?.contentRating === 'sfw' && process.env.COMFY_SFW_URL) {
    process.env.COMFYUI_BASE_URL = process.env.COMFY_SFW_URL
  }

  try {
  const { jobId } = await submitWorkflow(workflow)

  options?.onProgress?.('submitted')

  const history = await waitForJob(jobId, {
    pollIntervalMs: options?.pollIntervalMs,
    timeoutMs: options?.timeoutMs,
    onProgress: (status) => options?.onProgress?.(status),
  })

  options?.onProgress?.('downloading')

  const assets = await downloadAllAssets(history, jobId)

  const resultAssets: GenerationResult['assets'] = []
  assets.forEach((value, filename) => {
    resultAssets.push({
      filename,
      buffer: value.buffer,
      kind: value.kind,
    })
  })

  return {
    jobId,
    backend: 'comfyui',
    assets: resultAssets,
  }
  } finally {
    process.env.COMFYUI_BASE_URL = originalBaseUrl
  }
}

/**
 * Generate using RunPod Serverless API.
 */
async function generateWithRunPod(
  workflow: ComfyUIWorkflow,
  options?: GenerationOptions
): Promise<GenerationResult> {
  const { jobId } = await submitRunPodJob(workflow, {
    webhook: options?.webhook,
    idempotencyKey: options?.idempotencyKey,
  })

  options?.onProgress?.('submitted')

  const job = await waitForRunPodJob(jobId, {
    pollIntervalMs: options?.pollIntervalMs,
    timeoutMs: options?.timeoutMs,
    onProgress: (status) => options?.onProgress?.(status.toLowerCase()),
  })

  options?.onProgress?.('downloading')

  const assets: GenerationResult['assets'] = []

  // Download images
  if (job.output?.images) {
    for (const img of job.output.images) {
      const buffer = await downloadRunPodAsset(img.url)
      assets.push({
        filename: img.filename,
        buffer,
        kind: 'image',
      })
    }
  }

  // Download videos
  if (job.output?.videos) {
    for (const vid of job.output.videos) {
      const buffer = await downloadRunPodAsset(vid.url)
      assets.push({
        filename: vid.filename,
        buffer,
        kind: 'video',
      })
    }
  }

  return {
    jobId,
    backend: 'runpod',
    assets,
  }
}

/**
 * Get the status of a running job.
 * Works with both backends based on how the job was submitted.
 */
export async function getJobStatus(
  jobId: string,
  backend: GenerationBackend
): Promise<{ status: string; output?: unknown; error?: string }> {
  if (backend === 'runpod') {
    const job = await (await import('./runpod')).getRunPodJobStatus(jobId)
    return {
      status: job.status,
      output: job.output,
      error: job.error,
    }
  }

  const history = await (await import('./client')).getHistory(jobId)
  if (!history || !history[jobId]) {
    return { status: 'pending' }
  }

  const entry = history[jobId]
  if (entry.outputs && Object.keys(entry.outputs).length > 0) {
    return { status: 'completed', output: entry.outputs }
  }

  if (entry.status?.status_str === 'error') {
    return { status: 'failed', error: entry.status.messages?.[0]?.[0] }
  }

  return { status: 'running' }
}
