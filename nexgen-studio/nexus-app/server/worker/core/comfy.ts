import WebSocket from 'ws'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

export function comfyBaseUrl(policy: 'SFW' | 'NSFW') {
  return policy === 'NSFW' ? requireEnv('COMFY_NSFW_URL') : requireEnv('COMFY_SFW_URL')
}

export async function submitPrompt(baseUrl: string, prompt: unknown, clientId: string) {
  const response = await fetch(`${baseUrl}/api/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, client_id: clientId }),
  })

  if (!response.ok) {
    throw new Error(`Comfy submit failed: ${response.status}`)
  }

  const data = await response.json()
  if (!data?.prompt_id) {
    throw new Error('Comfy response missing prompt_id')
  }
  return String(data.prompt_id)
}

export function connectProgressWs(
  baseUrl: string,
  clientId: string,
  onMessage: (message: any) => void
) {
  const wsUrl = `${baseUrl.replace(/^http/, 'ws')}/ws?clientId=${encodeURIComponent(clientId)}`
  const ws = new WebSocket(wsUrl)
  ws.on('message', (data) => {
    try {
      onMessage(JSON.parse(data.toString()))
    } catch {
      // Ignore malformed payloads.
    }
  })
  return ws
}

export async function fetchHistory(baseUrl: string, promptId: string) {
  const response = await fetch(`${baseUrl}/history/${encodeURIComponent(promptId)}`)
  if (!response.ok) {
    throw new Error(`Comfy history failed: ${response.status}`)
  }
  return response.json()
}

export async function downloadOutput(
  baseUrl: string,
  params: { filename: string; subfolder?: string; type?: string }
) {
  const search = new URLSearchParams()
  search.set('filename', params.filename)
  if (params.subfolder) search.set('subfolder', params.subfolder)
  if (params.type) search.set('type', params.type)
  const primaryPath = process.env.COMFY_VIEW_PATH || '/api/view'

  let response = await fetch(`${baseUrl}${primaryPath}?${search.toString()}`)
  if (response.status === 404 && primaryPath !== '/view') {
    response = await fetch(`${baseUrl}/view?${search.toString()}`)
  }

  if (!response.ok) {
    throw new Error(`Comfy output download failed: ${response.status}`)
  }

  return Buffer.from(await response.arrayBuffer())
}
