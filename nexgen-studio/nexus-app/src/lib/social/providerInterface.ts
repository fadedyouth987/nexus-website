/**
 * Unified interface for all social platform adapters.
 * Each provider (Instagram, Facebook, TikTok, etc.) implements this interface.
 */

export type SocialProviderId =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'twitter'
  | 'youtube'
  | 'linkedin'
  | 'pinterest'
  | 'reddit'

export interface OAuthConfig {
  clientId: string
  clientSecret: string
  redirectUri: string
  scopes: string[]
  authUrl: string
  tokenUrl: string
}

export interface TokenSet {
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
  scopes?: string[]
}

export interface PublishPostInput {
  accountId: string
  accessToken: string
  refreshToken?: string
  caption: string
  mediaUrls: string[]
  options?: Record<string, unknown>
}

export interface PublishPostResult {
  success: boolean
  externalPostId?: string
  error?: string
}

export interface AnalyticsMetric {
  metricType: string
  value: number
  capturedAt: Date
}

export interface WebhookVerificationInput {
  rawBody: string
  signature: string
  headers: Record<string, string>
}

export interface WebhookVerificationResult {
  valid: boolean
  challenge?: string
}

export interface WebhookEvent {
  eventType: string
  payload: Record<string, unknown>
  receivedAt: Date
}

export interface ISocialProvider {
  readonly providerId: SocialProviderId

  /** Build OAuth URL and return config for connect flow */
  getOAuthConfig(redirectUri: string): OAuthConfig

  /** Exchange authorization code for tokens */
  exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    config: OAuthConfig
  ): Promise<TokenSet>

  /** Refresh access token using refresh token */
  refreshToken(
    refreshToken: string,
    config: OAuthConfig
  ): Promise<TokenSet>

  /** Publish a post (image/video + caption) */
  publishPost(input: PublishPostInput): Promise<PublishPostResult>

  /** Fetch analytics for the connected account */
  fetchAnalytics(
    accountId: string,
    accessToken: string,
    options?: { since?: Date; until?: Date }
  ): Promise<AnalyticsMetric[]>

  /** Verify webhook signature and optionally return challenge for subscription */
  verifyWebhook(input: WebhookVerificationInput): Promise<WebhookVerificationResult>

  /** Parse raw webhook body into normalized event(s) */
  parseWebhookPayload(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<WebhookEvent[]>
}
