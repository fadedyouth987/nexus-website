/**
 * RunPod Serverless API client for ComfyUI workflows.
 * Use this for GPU-accelerated generation on RunPod's infrastructure.
 *
 * Environment variables:
 * - RUNPOD_API_KEY: Your RunPod API key
 * - RUNPOD_ENDPOINT_ID: Your RunPod Serverless endpoint ID
 */

import type { ComfyUIWorkflow, ComfyUIOutputAsset } from './types'

const RUNPOD_API_BASE = 'https://api.runpod.ai/v2'

function getApiKey(): string {
  const key = process.env.RUNPOD_API_KEY
  if (!key) {
    throw new Error('RUNPOD_API_KEY environment variable is required')
  }
  return key
}

function getEndpointId(): string {
  const id = process.env.RUNPOD_ENDPOINT_ID
  if (!id) {
    throw new Error('RUNPOD_ENDPOINT_ID environment variable is required')
  }
  return id
}

interface RunPodJobInput {
  workflow: ComfyUIWorkflow
  [key: string]: unknown
}

interface RunPodJobResponse {
  id: string
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMED_OUT'
  input?: RunPodJobInput
  output?: {
    images?: Array<{
      url: string
      filename: string
      type: string
    }>
    videos?: Array<{
      url: string
      filename: string
      type: string
    }>
    [key: string]: unknown
  }
  error?: string
  delayTime?: number
  executionTime?: number
  idempotencyKey?: string
}

/**
 * Submit a ComfyUI workflow to RunPod Serverless API.
 * Returns a job ID that you can use to poll for results.
 */
export async function submitRunPodJob(
  workflow: ComfyUIWorkflow,
  options?: {
    webhook?: string
    idempotencyKey?: string
  }
): Promise<{ jobId: string; status: string }> {
  const apiKey = getApiKey()
  const endpointId = getEndpointId()
  const url = `${RUNPOD_API_BASE}/${endpointId}/run`

  const body: { input: RunPodJobInput; webhook?: string; idempotencyKey?: string } = {
    input: { workflow },
  }

  if (options?.webhook) {
    body.webhook = options.webhook
  }
  if (options?.idempotencyKey) {
    body.idempotencyKey = options.idempotencyKey
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RunPod submit failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as RunPodJobResponse
  if (!data.id) {
    throw new Error('RunPod did not return job ID')
  }

  return { jobId: data.id, status: data.status }
}

/**
 * Check the status of a RunPod job.
 */
export async function getRunPodJobStatus(jobId: string): Promise<RunPodJobResponse> {
  const apiKey = getApiKey()
  const endpointId = getEndpointId()
  const url = `${RUNPOD_API_BASE}/${endpointId}/status/${jobId}`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`RunPod status check failed (${res.status}): ${text}`)
  }

  return (await res.json()) as RunPodJobResponse
}

/**
 * Poll a RunPod job until it completes or fails.
 */
export async function waitForRunPodJob(
  jobId: string,
  options: {
    pollIntervalMs?: number
    timeoutMs?: number
    onProgress?: (status: string) => void
  } = {}
): Promise<RunPodJobResponse> {
  const pollIntervalMs = options.pollIntervalMs ?? 2000
  const timeoutMs = options.timeoutMs ?? 600_000 // 10 min default
  const onProgress = options.onProgress ?? (() => {})

  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const job = await getRunPodJobStatus(jobId)

    onProgress(job.status)

    if (job.status === 'COMPLETED') {
      return job
    }

    if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'TIMED_OUT') {
      throw new Error(`RunPod job ${jobId} failed: ${job.error || job.status}`)
    }

    // Job is IN_QUEUE or IN_PROGRESS, keep polling
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  throw new Error(`RunPod job ${jobId} timed out after ${timeoutMs}ms`)
}

/**
 * Convert RunPod output to ComfyUI-style assets for consistent handling.
 */
export function convertRunPodOutputToAssets(job: RunPodJobResponse): ComfyUIOutputAsset[] {
  const assets: ComfyUIOutputAsset[] = []

  if (job.output?.images) {
    for (const img of job.output.images) {
      assets.push({
        filename: img.filename,
        subfolder: '',
        type: img.type || 'output',
        kind: 'image',
      })
    }
  }

  if (job.output?.videos) {
    for (const vid of job.output.videos) {
      assets.push({
        filename: vid.filename,
        subfolder: '',
        type: vid.type || 'output',
        kind: 'video',
      })
    }
  }

  return assets
}

/**
 * Download an asset from a RunPod output URL.
 */
export async function downloadRunPodAsset(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to download RunPod asset (${res.status}): ${url}`)
  }
  return res.arrayBuffer()
}

/**
 * Full pipeline: submit workflow, wait for completion, download all assets.
 */
export async function runPodGenerate(
  workflow: ComfyUIWorkflow,
  options?: {
    pollIntervalMs?: number
    timeoutMs?: number
    onProgress?: (status: string) => void
    webhook?: string
  }
): Promise<{
  jobId: string
  assets: Array<{ filename: string; buffer: ArrayBuffer; kind: 'image' | 'video' }>
}> {
  const { jobId } = await submitRunPodJob(workflow, { webhook: options?.webhook })

  const job = await waitForRunPodJob(jobId, {
    pollIntervalMs: options?.pollIntervalMs,
    timeoutMs: options?.timeoutMs,
    onProgress: options?.onProgress,
  })

  const assets: Array<{ filename: string; buffer: ArrayBuffer; kind: 'image' | 'video' }> = []

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

  return { jobId, assets }
}
