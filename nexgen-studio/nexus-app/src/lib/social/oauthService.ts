import { getProvider } from './providers'
import type { SocialProviderId } from './providerInterface'
import { encryptToken } from './encryption'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export interface ConnectResult {
  authUrl: string
  state: string
}

const STATE_PREFIX = 'nexgen_social_'

export function buildConnectUrl(providerId: SocialProviderId, redirectUri: string, state: string): ConnectResult {
  const provider = getProvider(providerId)
  const config = provider.getOAuthConfig(redirectUri)
  if (!config.clientId) throw new Error(`${providerId} OAuth not configured (missing client id)`)
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: config.scopes.join(','),
    state,
  })
  const authUrl = `${config.authUrl}?${params.toString()}`
  return { authUrl, state }
}

export async function handleCallback(
  providerId: SocialProviderId,
  code: string,
  redirectUri: string,
  userId: string,
  accountName: string,
  accountIdFromApi?: string
): Promise<{ accountId: string }> {
  const provider = getProvider(providerId)
  const config = provider.getOAuthConfig(redirectUri)
  const tokenSet = await provider.exchangeCodeForTokens(code, redirectUri, config)
  const accessEncrypted = encryptToken(tokenSet.accessToken)
  const refreshEncrypted = tokenSet.refreshToken ? encryptToken(tokenSet.refreshToken) : null
  const admin = getEngineSupabaseAdmin()
  const accountId = accountIdFromApi || `oauth_${userId}_${providerId}_${Date.now()}`
  const { data, error } = await admin
    .from('social_accounts')
    .upsert(
      {
        user_id: userId,
        provider: providerId,
        account_name: accountName,
        account_id: accountId,
        access_token_encrypted: accessEncrypted,
        refresh_token_encrypted: refreshEncrypted,
        token_expires_at: tokenSet.expiresAt?.toISOString() ?? null,
        scopes: tokenSet.scopes ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider,account_id', ignoreDuplicates: false }
    )
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return { accountId: data?.id ?? accountId }
}
