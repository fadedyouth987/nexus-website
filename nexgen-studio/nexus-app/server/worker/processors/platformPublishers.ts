type PublishRequest = {
  scheduleId: string
  platform: string
  contentId: string
  orgId: string
  workspaceId: string
  payload: Record<string, unknown>
}

type PublishResult = {
  externalPostId: string
  publishedAt: string
}

type PublisherMode = 'mock' | 'webhook'

function env(name: string) {
  const value = process.env[name]
  return typeof value === 'string' ? value : ''
}

function publisherMode(): PublisherMode {
  const mode = env('PUBLISHER_MODE').toLowerCase()
  return mode === 'webhook' ? 'webhook' : 'mock'
}

function platformKey(platform: string) {
  return platform.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

function webhookUrlFor(platform: string) {
  const key = platformKey(platform)
  const specific = env(`PUBLISH_WEBHOOK_${key}_URL`)
  if (specific) return specific
  return env('PUBLISH_WEBHOOK_DEFAULT_URL')
}

function bearerTokenFor(platform: string) {
  const key = platformKey(platform)
  const specific = env(`PUBLISH_WEBHOOK_${key}_TOKEN`)
  if (specific) return specific
  return env('PUBLISH_WEBHOOK_DEFAULT_TOKEN')
}

function mockedExternalId(platform: string, scheduleId: string) {
  const stamp = Date.now().toString(36)
  return `${platform}_${scheduleId.replace(/-/g, '').slice(0, 8)}_${stamp}`
}

async function publishViaWebhook(input: PublishRequest): Promise<PublishResult> {
  const url = webhookUrlFor(input.platform)
  if (!url) {
    throw new Error(`Missing webhook URL for platform ${input.platform}`)
  }

  const token = bearerTokenFor(input.platform)
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      schedule_id: input.scheduleId,
      content_id: input.contentId,
      org_id: input.orgId,
      workspace_id: input.workspaceId,
      platform: input.platform,
      payload: input.payload,
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Publish webhook failed (${response.status}): ${text || response.statusText}`)
  }

  const json = (await response.json().catch(() => ({}))) as Partial<PublishResult>
  return {
    externalPostId: typeof json.externalPostId === 'string' ? json.externalPostId : mockedExternalId(input.platform, input.scheduleId),
    publishedAt: typeof json.publishedAt === 'string' ? json.publishedAt : new Date().toISOString(),
  }
}

function publishViaMock(input: PublishRequest): PublishResult {
  return {
    externalPostId: mockedExternalId(input.platform, input.scheduleId),
    publishedAt: new Date().toISOString(),
  }
}

export async function publishToPlatform(input: PublishRequest): Promise<PublishResult> {
  if (publisherMode() === 'webhook') {
    return publishViaWebhook(input)
  }
  return publishViaMock(input)
}

