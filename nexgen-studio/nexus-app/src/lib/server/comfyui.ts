type ComfyHistoryNodeOutput = {
  images?: Array<{
    filename?: string
    subfolder?: string
    type?: string
  }>
}

type ComfyHistoryEntry = {
  outputs?: Record<string, ComfyHistoryNodeOutput>
  status?: {
    status_str?: string
    messages?: unknown[]
  }
}

export type ComfyOutputFile = {
  filename: string
  subfolder?: string
  type?: string
}

const DEFAULT_POLL_MS = 2000
const DEFAULT_TIMEOUT_MS = 900_000
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000

let hasWarnedAboutConnectivity = false

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getComfyuiBaseUrl() {
  const baseUrl = process.env.COMFYUI_BASE_URL || process.env.COMFY_SFW_URL
  if (!baseUrl) {
    throw new Error('Missing required environment variable: COMFYUI_BASE_URL')
  }
  return stripTrailingSlash(baseUrl)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

async function fetchFromPaths(
  baseUrl: string,
  paths: string[],
  init: RequestInit,
  timeoutMs: number
) {
  let lastError: Error | null = null

  for (const path of paths) {
    const url = `${baseUrl}${path}`
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs)
      if (response.status === 404) {
        continue
      }
      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown fetch failure')
    }
  }

  if (lastError) {
    throw lastError
  }

  throw new Error(`No ComfyUI endpoint matched for paths: ${paths.join(', ')}`)
}

async function fetchHistoryEntry(baseUrl: string, promptId: string) {
  const encodedPromptId = encodeURIComponent(promptId)
  const response = await fetchFromPaths(
    baseUrl,
    [`/history/${encodedPromptId}`, `/api/history/${encodedPromptId}`],
    { method: 'GET' },
    DEFAULT_REQUEST_TIMEOUT_MS
  )

  if (!response.ok) {
    throw new Error(`ComfyUI history request failed: HTTP ${response.status}`)
  }

  const payload = (await response.json()) as Record<string, ComfyHistoryEntry>
  return payload?.[promptId] || null
}

export async function comfyuiWarnIfUnreachable() {
  if (hasWarnedAboutConnectivity) {
    return
  }
  try {
    const baseUrl = getComfyuiBaseUrl()
    const response = await fetchFromPaths(
      baseUrl,
      ['/system_stats', '/api/system_stats'],
      { method: 'GET' },
      3000
    )

    if (!response.ok) {
      console.warn(`[comfyui] health check returned HTTP ${response.status} for ${baseUrl}`)
      hasWarnedAboutConnectivity = true
      return
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.warn(`[comfyui] reachability check skipped: ${message}`)
  }

  hasWarnedAboutConnectivity = true
}

export async function comfyuiSubmit(workflow: object): Promise<{ prompt_id: string }> {
  const baseUrl = getComfyuiBaseUrl()
  const response = await fetchFromPaths(
    baseUrl,
    ['/prompt', '/api/prompt'],
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: workflow,
      }),
    },
    DEFAULT_REQUEST_TIMEOUT_MS
  )

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(
      `ComfyUI submit failed (HTTP ${response.status})${details ? `: ${details.slice(0, 240)}` : ''}`
    )
  }

  const payload = (await response.json()) as { prompt_id?: string }
  if (!payload?.prompt_id || typeof payload.prompt_id !== 'string') {
    throw new Error('ComfyUI submit response missing prompt_id')
  }

  console.log(`[comfyui] submitted prompt_id=${payload.prompt_id}`)
  return { prompt_id: payload.prompt_id }
}

export async function comfyuiPoll(promptId: string): Promise<{ outputs: Record<string, unknown> }> {
  const baseUrl = getComfyuiBaseUrl()
  const pollMs = parsePositiveInt(process.env.COMFYUI_POLL_MS, DEFAULT_POLL_MS)
  const timeoutMs = parsePositiveInt(process.env.COMFYUI_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
  const startedAt = Date.now()
  let lastError: Error | null = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const historyEntry = await fetchHistoryEntry(baseUrl, promptId)
      if (historyEntry?.status?.status_str === 'error') {
        throw new Error(`ComfyUI prompt ${promptId} entered error state`)
      }

      if (historyEntry?.outputs && Object.keys(historyEntry.outputs).length > 0) {
        return {
          outputs: historyEntry.outputs as Record<string, unknown>,
        }
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown ComfyUI poll error')
    }

    await sleep(pollMs)
  }

  throw new Error(
    `ComfyUI poll timed out for prompt_id ${promptId} after ${timeoutMs}ms${
      lastError ? ` (last error: ${lastError.message})` : ''
    }`
  )
}

export function comfyuiResolveFirstImageOutput(history: { outputs: Record<string, unknown> }): ComfyOutputFile | null {
  const outputs = history.outputs || {}

  for (const nodeOutput of Object.values(outputs)) {
    if (!nodeOutput || typeof nodeOutput !== 'object') {
      continue
    }

    const images = (nodeOutput as ComfyHistoryNodeOutput).images
    if (!Array.isArray(images)) {
      continue
    }

    for (const candidate of images) {
      if (candidate && typeof candidate.filename === 'string' && candidate.filename) {
        return {
          filename: candidate.filename,
          subfolder: typeof candidate.subfolder === 'string' ? candidate.subfolder : undefined,
          type: typeof candidate.type === 'string' ? candidate.type : undefined,
        }
      }
    }
  }

  return null
}

export async function comfyuiDownloadOutput(file: ComfyOutputFile) {
  const baseUrl = getComfyuiBaseUrl()
  const search = new URLSearchParams()
  search.set('filename', file.filename)
  if (file.subfolder) {
    search.set('subfolder', file.subfolder)
  }
  if (file.type) {
    search.set('type', file.type)
  }

  const primaryViewPath = process.env.COMFY_VIEW_PATH?.trim() || '/view'
  const response = await fetchFromPaths(
    baseUrl,
    [`${primaryViewPath}?${search.toString()}`, `/view?${search.toString()}`, `/api/view?${search.toString()}`],
    { method: 'GET' },
    DEFAULT_REQUEST_TIMEOUT_MS
  )

  if (!response.ok) {
    throw new Error(`ComfyUI output download failed (HTTP ${response.status}) for ${file.filename}`)
  }

  return Buffer.from(await response.arrayBuffer())
}
