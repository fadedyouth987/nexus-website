import { getProvider } from './providers'
import type { SocialProviderId } from './providerInterface'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export async function verifyAndStoreWebhook(
  providerId: SocialProviderId,
  rawBody: string,
  signature: string,
  headers: Record<string, string>
): Promise<{ verified: boolean; challenge?: string }> {
  const provider = getProvider(providerId)
  const result = await provider.verifyWebhook({ rawBody, signature, headers })
  if (result.challenge) return { verified: true, challenge: result.challenge }
  if (!result.valid) return { verified: false }
  const events = await provider.parseWebhookPayload(rawBody, headers)
  const admin = getEngineSupabaseAdmin()
  for (const ev of events) {
    await admin.from('webhook_events').insert({
      provider: providerId,
      event_type: ev.eventType,
      payload: ev.payload,
      received_at: ev.receivedAt.toISOString(),
      processed: false,
    })
  }
  return { verified: true }
}

export async function markWebhookProcessed(eventId: string): Promise<void> {
  const admin = getEngineSupabaseAdmin()
  await admin
    .from('webhook_events')
    .update({ processed: true, processed_at: new Date().toISOString() })
    .eq('id', eventId)
}
