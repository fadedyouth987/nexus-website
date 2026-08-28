/**
 * Facebook Pages provider adapter (stub – extend similarly to Instagram).
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

const PROVIDER_ID = 'facebook' as const

export class FacebookProvider implements ISocialProvider {
  readonly providerId = PROVIDER_ID

  getOAuthConfig(redirectUri: string): OAuthConfig {
    return {
      clientId: process.env.META_APP_ID || '',
      clientSecret: process.env.META_APP_SECRET || '',
      redirectUri,
      scopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'],
      authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
      tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    }
  }

  async exchangeCodeForTokens(code: string, redirectUri: string, config: OAuthConfig): Promise<TokenSet> {
    const params = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    })
    const res = await fetch(`${config.tokenUrl}?${params.toString()}`)
    if (!res.ok) throw new Error(`Facebook token exchange failed: ${await res.text()}`)
    const data = (await res.json()) as { access_token: string; expires_in?: number }
    return {
      accessToken: data.access_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
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
    const res = await fetch(`https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`)
    if (!res.ok) throw new Error(`Facebook token refresh failed: ${await res.text()}`)
    const data = (await res.json()) as { access_token: string; expires_in?: number }
    return {
      accessToken: data.access_token,
      refreshToken,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
    }
  }

  async publishPost(input: PublishPostInput): Promise<PublishPostResult> {
    const url = input.mediaUrls[0] || ''
    const res = await fetch(
      `https://graph.facebook.com/v18.0/${input.accountId}/feed?message=${encodeURIComponent(input.caption)}${url ? `&link=${encodeURIComponent(url)}` : ''}&access_token=${encodeURIComponent(input.accessToken)}`,
      { method: 'POST' }
    )
    if (!res.ok) return { success: false, error: await res.text() }
    const data = (await res.json()) as { id?: string }
    return { success: true, externalPostId: data.id }
  }

  async fetchAnalytics(): Promise<AnalyticsMetric[]> {
    return []
  }

  async verifyWebhook(input: WebhookVerificationInput): Promise<WebhookVerificationResult> {
    const token = input.headers['x-hub-verify-token']
    const challenge = input.headers['x-hub-challenge']
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim()
    if (verifyToken && token === verifyToken && challenge) {
      return { valid: true, challenge }
    }
    return { valid: false }
  }

  async parseWebhookPayload(rawBody: string, _headers?: Record<string, string>): Promise<WebhookEvent[]> {
    try {
      const body = JSON.parse(rawBody) as { entry?: Array<{ id?: string; time?: number }> }
      const events: WebhookEvent[] = []
      for (const entry of body.entry || []) {
        events.push({
          eventType: 'page_activity',
          payload: entry,
          receivedAt: new Date(entry.time || Date.now()),
        })
      }
      return events
    } catch {
      return []
    }
  }
}

export const facebookProvider = new FacebookProvider()
