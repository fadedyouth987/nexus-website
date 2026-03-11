/**
 * Instagram (Meta Graph API) provider adapter.
 * Uses Instagram Graph API / Facebook Login for OAuth.
 */

import type {
  ISocialProvider,
  OAuthConfig,
  TokenSet,
  PublishPostInput,
  PublishPostResult,
  AnalyticsMetric,
  WebhookVerificationInput,
  WebhookVerificationResult,
  WebhookEvent,
} from '../providerInterface'

const PROVIDER_ID = 'instagram' as const
const META_AUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth'
const META_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token'
const META_GRAPH_URL = 'https://graph.facebook.com/v18.0'

export class InstagramProvider implements ISocialProvider {
  readonly providerId = PROVIDER_ID

  getOAuthConfig(redirectUri: string): OAuthConfig {
    const clientId = process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID || ''
    const clientSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || ''
    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement'],
      authUrl: META_AUTH_URL,
      tokenUrl: META_TOKEN_URL,
    }
  }

  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    config: OAuthConfig
  ): Promise<TokenSet> {
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    })
    const res = await fetch(`${config.tokenUrl}?${params.toString()}`, { method: 'GET' })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Instagram token exchange failed: ${err}`)
    }
    const data = (await res.json()) as {
      access_token: string
      token_type?: string
      expires_in?: number
      refresh_token?: string
    }
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt,
      scopes: config.scopes,
    }
  }

  async refreshToken(refreshToken: string, config: OAuthConfig): Promise<TokenSet> {
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      fb_exchange_token: refreshToken,
    })
    const res = await fetch(`${config.tokenUrl}?${params.toString()}`, { method: 'GET' })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Instagram token refresh failed: ${err}`)
    }
    const data = (await res.json()) as {
      access_token: string
      expires_in?: number
      refresh_token?: string
    }
    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt,
    }
  }

  async publishPost(input: PublishPostInput): Promise<PublishPostResult> {
    try {
      const { accessToken, caption, mediaUrls } = input
      const mediaType = mediaUrls.length > 1 ? 'CAROUSEL' : mediaUrls.length === 1 ? 'IMAGE' : 'NONE'
      let containerId: string

      if (mediaUrls.length === 0) {
        return { success: false, error: 'At least one media URL required for Instagram' }
      }

      if (mediaUrls.length === 1) {
        const createRes = await fetch(
          `${META_GRAPH_URL}/${input.accountId}/media?image_url=${encodeURIComponent(mediaUrls[0])}&caption=${encodeURIComponent(caption)}&access_token=${encodeURIComponent(accessToken)}`,
          { method: 'POST' }
        )
        if (!createRes.ok) {
          const err = await createRes.text()
          return { success: false, error: err }
        }
        const createData = (await createRes.json()) as { id: string }
        containerId = createData.id
      } else {
        const children = mediaUrls.map((url) => encodeURIComponent(url)).join(',')
        const createRes = await fetch(
          `${META_GRAPH_URL}/${input.accountId}/media?media_type=CAROUSEL&children=[${children}]&caption=${encodeURIComponent(caption)}&access_token=${encodeURIComponent(accessToken)}`,
          { method: 'POST' }
        )
        if (!createRes.ok) {
          const err = await createRes.text()
          return { success: false, error: err }
        }
        const createData = (await createRes.json()) as { id: string }
        containerId = createData.id
      }

      const publishRes = await fetch(
        `${META_GRAPH_URL}/${input.accountId}/media_publish?creation_id=${containerId}&access_token=${encodeURIComponent(accessToken)}`,
        { method: 'POST' }
      )
      if (!publishRes.ok) {
        const err = await publishRes.text()
        return { success: false, error: err }
      }
      const publishData = (await publishRes.json()) as { id: string }
      return { success: true, externalPostId: publishData.id }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      return { success: false, error: message }
    }
  }

  async fetchAnalytics(
    accountId: string,
    accessToken: string,
    options?: { since?: Date; until?: Date }
  ): Promise<AnalyticsMetric[]> {
    const metrics: AnalyticsMetric[] = []
    try {
      const fields = 'insights.metric(impressions,reach,engagement,saved)'
      const res = await fetch(
        `${META_GRAPH_URL}/${accountId}?fields=${fields}&access_token=${encodeURIComponent(accessToken)}`
      )
      if (!res.ok) return metrics
      const data = (await res.json()) as {
        insights?: { data?: Array<{ name: string; values?: Array<{ value: number }> }> }
      }
      const now = new Date()
      for (const insight of data.insights?.data || []) {
        const value = insight.values?.[0]?.value ?? 0
        metrics.push({
          metricType: insight.name,
          value,
          capturedAt: now,
        })
      }
    } catch {
      // ignore
    }
    return metrics
  }

  async verifyWebhook(input: WebhookVerificationInput): Promise<WebhookVerificationResult> {
    const appSecret = process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || ''
    const mode = input.headers['x-hub-mode']
    const token = input.headers['x-hub-verify-token']
    const challenge = input.headers['x-hub-challenge']
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'nexgen-verify'
    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return { valid: true, challenge }
    }
    if (input.signature && appSecret) {
      const crypto = await import('crypto')
      const expected = crypto.createHmac('sha256', appSecret).update(input.rawBody).digest('hex')
      const sig = input.signature.replace('sha256=', '')
      return { valid: sig === expected }
    }
    return { valid: false }
  }

  async parseWebhookPayload(
    rawBody: string,
    _headers: Record<string, string>
  ): Promise<WebhookEvent[]> {
    try {
      const body = JSON.parse(rawBody) as { object?: string; entry?: Array<{ id?: string; time?: number; messaging?: unknown[]; changes?: unknown[] }> }
      if (body.object !== 'instagram' && body.object !== 'page') return []
      const events: WebhookEvent[] = []
      for (const entry of body.entry || []) {
        const receivedAt = entry.time ? new Date(entry.time) : new Date()
        if (entry.messaging?.length) {
          for (const msg of entry.messaging as Record<string, unknown>[]) {
            events.push({
              eventType: 'message',
              payload: msg,
              receivedAt,
            })
          }
        }
        if (entry.changes?.length) {
          for (const change of entry.changes as Record<string, unknown>[]) {
            events.push({
              eventType: 'change',
              payload: change,
              receivedAt,
            })
          }
        }
      }
      return events
    } catch {
      return []
    }
  }
}

export const instagramProvider = new InstagramProvider()
