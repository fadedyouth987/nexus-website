/**
 * Base stub for providers not yet fully implemented.
 * Implements ISocialProvider with no-op or throw for OAuth/publish.
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
import type { SocialProviderId } from '../providerInterface'

export function createStubProvider(providerId: SocialProviderId): ISocialProvider {
  return {
    providerId,
    getOAuthConfig(redirectUri: string): OAuthConfig {
      const envKey = providerId.toUpperCase().replace(' ', '_')
      return {
        clientId: process.env[`${envKey}_CLIENT_ID`] || '',
        clientSecret: process.env[`${envKey}_CLIENT_SECRET`] || '',
        redirectUri,
        scopes: [],
        authUrl: `https://${providerId}.com/oauth`,
        tokenUrl: `https://api.${providerId}.com/oauth/token`,
      }
    },
    async exchangeCodeForTokens(): Promise<TokenSet> {
      throw new Error(`${providerId} OAuth not configured. Set ${providerId.toUpperCase()}_CLIENT_ID and _CLIENT_SECRET.`)
    },
    async refreshToken(): Promise<TokenSet> {
      throw new Error(`${providerId} token refresh not implemented.`)
    },
    async publishPost(): Promise<PublishPostResult> {
      return { success: false, error: `${providerId} publish not implemented.` }
    },
    async fetchAnalytics(): Promise<AnalyticsMetric[]> {
      return []
    },
    async verifyWebhook(input: WebhookVerificationInput): Promise<WebhookVerificationResult> {
      const challenge = input.headers['x-challenge'] || input.headers['challenge']
      if (challenge) return { valid: true, challenge: String(challenge) }
      return { valid: false }
    },
    async parseWebhookPayload(rawBody: string): Promise<WebhookEvent[]> {
      try {
        const body = JSON.parse(rawBody) as Record<string, unknown>
        return [{
          eventType: 'webhook_received',
          payload: body,
          receivedAt: new Date(),
        }]
      } catch {
        return []
      }
    },
  }
}
