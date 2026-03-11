import { getProvider } from './providers'
import type { SocialProviderId } from './providerInterface'
import { decryptToken, encryptToken } from './encryption'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export interface SocialAccountRow {
  id: string
  user_id: string
  provider: string
  account_name: string
  account_id: string
  access_token_encrypted: string
  refresh_token_encrypted: string | null
  token_expires_at: string | null
  scopes: string[] | null
  created_at: string
  updated_at: string
}

export async function getAccountsForUser(userId: string): Promise<SocialAccountRow[]> {
  const admin = getEngineSupabaseAdmin()
  const { data, error } = await admin
    .from('social_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []) as SocialAccountRow[]
}

export async function getAccountById(accountId: string, userId: string): Promise<SocialAccountRow | null> {
  const admin = getEngineSupabaseAdmin()
  const { data, error } = await admin
    .from('social_accounts')
    .select('*')
    .eq('id', accountId)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as SocialAccountRow | null
}

export async function getAccessToken(account: SocialAccountRow): Promise<string> {
  let access = decryptToken(account.access_token_encrypted)
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null
  if (expiresAt && expiresAt.getTime() - Date.now() < 60 * 5 * 1000 && account.refresh_token_encrypted) {
    const provider = getProvider(account.provider as SocialProviderId)
    const config = provider.getOAuthConfig('')
    const refreshed = await provider.refreshToken(decryptToken(account.refresh_token_encrypted), config)
    access = refreshed.accessToken
    const admin = getEngineSupabaseAdmin()
    await admin
      .from('social_accounts')
      .update({
        access_token_encrypted: encryptToken(refreshed.accessToken),
        token_expires_at: refreshed.expiresAt?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id)
  }
  return access
}

export async function disconnectAccount(accountId: string, userId: string): Promise<void> {
  const admin = getEngineSupabaseAdmin()
  const { error } = await admin
    .from('social_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}
