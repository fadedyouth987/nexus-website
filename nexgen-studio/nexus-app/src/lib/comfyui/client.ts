/**
 * ComfyUI Headless client for RunPod A100 container.
 * Base URL: COMFYUI_BASE_URL (e.g. https://your-runpod-endpoint.com or http://host:8188)
 */

import type {
  ComfyUIWorkflow,
  ComfyUIPromptResponse,
  ComfyUIHistoryResponse,
  ComfyUIHistoryOutput,
  ComfyUIOutputAsset,
} from './types'

const DEFAULT_POLL_MS = 1500
const DEFAULT_TIMEOUT_MS = 600_000 // 10 min for video

function getBaseUrl(): string {
  const url = process.env.COMFYUI_BASE_URL || 'http://127.0.0.1:8188'
  return url.replace(/\/$/, '')
}

async function fetchComfy(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const base = getBaseUrl()
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  return res
}

/**
 * Submit a workflow to ComfyUI Headless /prompt API.
 * Returns prompt_id (job id) and queue number.
 */
export async function submitWorkflow(workflowJson: ComfyUIWorkflow): Promise<{
  jobId: string
  number: number
}> {
  const res = await fetchComfy('/prompt', {
    method: 'POST',
    body: JSON.stringify({ prompt: workflowJson }),
  })

  if (!res.ok) {
    const text = await res.text()
    let detail: string
    try {
      const json = JSON.parse(text) as { error?: unknown; node_errors?: unknown }
      detail =
        typeof json.error === 'string'
          ? json.error
          : JSON.stringify(json.node_errors ?? json)
    } catch {
      detail = text || res.statusText
    }
    throw new Error(`ComfyUI submit failed (${res.status}): ${detail}`)
  }

  const data = (await res.json()) as ComfyUIPromptResponse
  if (!data.prompt_id) {
    throw new Error('ComfyUI did not return prompt_id')
  }

  return {
    jobId: data.prompt_id,
    number: data.number ?? 0,
  }
}

/**
 * Fetch execution history for a prompt. When the run is complete, the prompt_id
 * appears in history with outputs.
 */
export async function getHistory(jobId: string): Promise<ComfyUIHistoryResponse | null> {
  const res = await fetchComfy(`/history/${jobId}`)
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ComfyUI history failed (${res.status}): ${text}`)
  }
  return (await res.json()) as ComfyUIHistoryResponse
}

/**
 * Wait for a job to complete by polling /history until the prompt_id appears
 * and has outputs. Supports optional timeout and poll interval.
 */
export async function waitForJob(
  jobId: string,
  options: {
    pollIntervalMs?: number
    timeoutMs?: number
    onProgress?: (message: string) => void
  } = {}
): Promise<ComfyUIHistoryResponse> {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_MS
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const onProgress = options.onProgress ?? (() => {})

  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const history = await getHistory(jobId)
    if (history && history[jobId]) {
      const entry = history[jobId]
      if (entry.outputs && Object.keys(entry.outputs).length > 0) {
        onProgress('completed')
        return history
      }
      if (entry.status?.status_str === 'error') {
        const msg =
          entry.status.messages?.[0]?.[0] ?? 'Execution failed'
        throw new Error(`ComfyUI execution error: ${msg}`)
      }
    }
    onProgress('running')
    await new Promise((r) => setTimeout(r, pollIntervalMs))
  }

  throw new Error(`ComfyUI job ${jobId} timed out after ${timeoutMs}ms`)
}

/**
 * Extract all image and video outputs from a history entry.
 */
export function getOutputAssetsFromHistory(
  history: ComfyUIHistoryResponse,
  jobId: string
): ComfyUIOutputAsset[] {
  const entry = history[jobId]
  if (!entry?.outputs) return []

  const assets: ComfyUIOutputAsset[] = []
  for (const output of Object.values(entry.outputs) as ComfyUIHistoryOutput[]) {
    if (output.images) {
      for (const img of output.images) {
        assets.push({
          filename: img.filename,
          subfolder: img.subfolder || '',
          type: img.type || 'output',
          kind: 'image',
        })
      }
    }
    if (output.gifs) {
      for (const gif of output.gifs) {
        assets.push({
          filename: gif.filename,
          subfolder: gif.subfolder || '',
          type: gif.type || 'output',
          kind: 'video',
        })
      }
    }
  }
  return assets
}

/**
 * Download a single asset (image or video) from ComfyUI /view.
 * Returns the response so you can read .arrayBuffer() or .blob().
 */
export async function downloadAsset(asset: ComfyUIOutputAsset): Promise<ArrayBuffer> {
  const base = getBaseUrl()
  const params = new URLSearchParams({
    filename: asset.filename,
    subfolder: asset.subfolder || '',
    type: asset.type || 'output',
  })
  const url = `${base}/view?${params.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`ComfyUI view failed (${res.status}): ${asset.filename}`)
  }
  return res.arrayBuffer()
}

/**
 * Download all output assets for a completed job and return buffers keyed by filename.
 */
export async function downloadAllAssets(
  history: ComfyUIHistoryResponse,
  jobId: string
): Promise<Map<string, { buffer: ArrayBuffer; kind: 'image' | 'video' }>> {
  const assets = getOutputAssetsFromHistory(history, jobId)
  const map = new Map<string, { buffer: ArrayBuffer; kind: 'image' | 'video' }>()
  for (const asset of assets) {
    const buffer = await downloadAsset(asset)
    map.set(asset.filename, { buffer, kind: asset.kind })
  }
  return map
}
