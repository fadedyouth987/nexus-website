import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function main() {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000'
  const workspaceId = process.env.WORKSPACE_ID || ''
  const windowMinutes = process.env.WORKER_HEALTH_WINDOW_MIN || '60'

  const params = new URLSearchParams()
  params.set('window_min', windowMinutes)
  if (workspaceId) {
    params.set('workspace_id', workspaceId)
  }

  const url = `${baseUrl}/api/worker/health?${params.toString()}`
  const response = await fetch(url)
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`)
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: response.status,
        url,
        payload,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  )
  process.exit(1)
})
