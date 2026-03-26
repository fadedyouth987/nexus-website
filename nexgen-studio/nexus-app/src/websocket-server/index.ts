import 'dotenv/config'
import { createServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import IORedis from 'ioredis'

const port = Number(process.env.WS_PORT || 3002)

const clients = new Map<WebSocket, { jobId?: string }>()

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('nexus websocket gateway')
})

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  const host = req.headers.host || 'localhost'
  const url = new URL(req.url || '/', `http://${host}`)
  const jobId = url.searchParams.get('jobId') || undefined
  clients.set(ws, { jobId })

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(String(data)) as { type?: string; jobId?: string }
      if (message.type === 'subscribe' && message.jobId) {
        const meta = clients.get(ws)
        if (meta) {
          meta.jobId = message.jobId
        }
      }
    } catch {
      // ignore
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
  })
})

function broadcast(jobId: string, data: Record<string, unknown>) {
  const payload = JSON.stringify({
    ...data,
    jobId,
    timestamp: Date.now(),
  })
  for (const [ws, meta] of clients) {
    if (meta.jobId === jobId && ws.readyState === WebSocket.OPEN) {
      ws.send(payload)
    }
  }
}

const redisUrl = process.env.REDIS_URL
if (redisUrl) {
  const sub = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  })
  sub.subscribe('job-updates').catch((e) => console.error('[ws] subscribe', e))
  sub.on('message', (_channel, message) => {
    try {
      const parsed = JSON.parse(message) as { jobId?: string; data?: Record<string, unknown> }
      if (parsed.jobId && parsed.data) {
        broadcast(parsed.jobId, parsed.data)
      }
    } catch (e) {
      console.error('[ws] bad message', e)
    }
  })
} else {
  console.warn('[ws] REDIS_URL not set — only local connections, no cross-process fan-out')
}

server.listen(port, () => {
  console.info(`[ws] WebSocket gateway on port ${port}`)
})
