import { buildTxt2ImgWorkflow, type LoraWire, type Txt2ImgInput } from '@/lib/ai/txt2imgWorkflow'

function baseUrl(): string {
  return (process.env.COMFYUI_URL || 'http://127.0.0.1:8188').replace(/\/$/, '')
}

export async function queuePrompt(
  workflow: Record<string, { class_type: string; inputs: Record<string, unknown> }>,
  clientId: string
): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.COMFYUI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.COMFYUI_API_KEY}`
  }
  const res = await fetch(`${baseUrl()}/prompt`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ prompt: workflow, client_id: clientId }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText)
    throw new Error(`ComfyUI /prompt failed: ${res.status} ${t}`)
  }
  const data = (await res.json()) as { prompt_id?: string; error?: { message?: string } }
  if (data.error?.message) {
    throw new Error(data.error.message)
  }
  if (!data.prompt_id) {
    throw new Error('ComfyUI did not return prompt_id')
  }
  return data.prompt_id
}

export async function fetchHistory(promptId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${baseUrl()}/history/${encodeURIComponent(promptId)}`)
  if (!res.ok) {
    return null
  }
  const json = (await res.json()) as Record<string, unknown>
  return (json[promptId] as Record<string, unknown>) ?? null
}

export async function waitForCompletion(
  promptId: string,
  timeoutMs: number,
  onProgress?: (p: number, message: string) => void
): Promise<{ outputs: { filename: string; subfolder: string; type: string }[]; seed?: number }> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const h = await fetchHistory(promptId)
    if (h?.outputs) {
      const outputs = h.outputs as Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>
      const images: { filename: string; subfolder: string; type: string }[] = []
      for (const v of Object.values(outputs)) {
        if (v?.images) {
          images.push(...v.images)
        }
      }
      if (images.length > 0) {
        onProgress?.(100, 'Complete')
        return { outputs: images }
      }
    }
    const pct = Math.min(90, Math.floor(((Date.now() - start) / timeoutMs) * 90))
    onProgress?.(pct, 'Waiting for ComfyUI…')
    await new Promise((r) => setTimeout(r, 1200))
  }
  throw new Error('ComfyUI generation timed out')
}

export async function getImageBuffer(
  filename: string,
  subfolder: string,
  type: string
): Promise<Buffer> {
  const params = new URLSearchParams({
    filename,
    subfolder,
    type,
  })
  const res = await fetch(`${baseUrl()}/view?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`ComfyUI /view failed ${res.status}`)
  }
  const ab = await res.arrayBuffer()
  return Buffer.from(ab)
}

function parseLoras(raw: unknown): LoraWire[] {
  if (!Array.isArray(raw)) {
    return []
  }
  const out: LoraWire[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const o = item as Record<string, unknown>
    if (o.enabled === false) {
      continue
    }
    const path = typeof o.path === 'string' ? o.path : typeof o.name === 'string' ? o.name : ''
    const strength = typeof o.strength === 'number' ? o.strength : 0.8
    if (path) {
      out.push({ path, strength })
    }
  }
  return out
}

export function buildWorkflowFromJobParams(params: unknown): Record<
  string,
  { class_type: string; inputs: Record<string, unknown> }
> {
  const p = params && typeof params === 'object' ? (params as Record<string, unknown>) : {}

  const input: Txt2ImgInput = {
    positive: typeof p.positive === 'string' ? p.positive : 'masterpiece, best quality',
    negative: typeof p.negative === 'string' ? p.negative : 'worst quality, low quality',
    width: typeof p.width === 'number' ? p.width : 512,
    height: typeof p.height === 'number' ? p.height : 512,
    steps: typeof p.steps === 'number' ? p.steps : 20,
    cfg: typeof p.cfg === 'number' ? p.cfg : 7,
    seed: typeof p.seed === 'number' ? p.seed : -1,
    sampler_name:
      typeof p.sampler_name === 'string'
        ? p.sampler_name
        : typeof p.sampler === 'string'
          ? p.sampler
          : 'euler',
    scheduler: typeof p.scheduler === 'string' ? p.scheduler : 'normal',
    denoise: typeof p.denoise === 'number' ? p.denoise : 1,
    model: typeof p.model === 'string' ? p.model : 'sd15',
    batch_size: typeof p.batch_size === 'number' ? p.batch_size : 1,
    loras: parseLoras(p.loras),
    clip_skip: typeof p.clipSkip === 'number' ? p.clipSkip : 1,
  }

  return buildTxt2ImgWorkflow(input)
}
