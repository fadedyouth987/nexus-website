import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import type { FactoryPersonaInput } from '@/lib/automation/pipeline/types'

type SupabaseAdmin = ReturnType<typeof getEngineSupabaseAdmin>

export async function createLegacyCreator(
  admin: SupabaseAdmin,
  userId: string,
  handle: string,
  persona: FactoryPersonaInput
): Promise<string | null> {
  const name = String(persona.name || '').trim()
  const niche = String(persona.niche || '').trim()

  const { data, error } = await admin
    .from('creators')
    .insert({
      user_id: userId,
      name,
      handle,
      niche,
      bio: persona.personality || '',
      style_template: persona.speech_style || 'default',
      vault_mode: persona.content_rating === 'nsfw' ? 'nsfw' : 'sfw',
      status: 'active',
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    return null
  }

  return String(data.id)
}

export async function getLegacyCreatorById(admin: SupabaseAdmin, id: string) {
  const { data } = await admin
    .from('creators')
    .select('id, user_id, name, handle, niche, status, created_at')
    .eq('id', id)
    .maybeSingle()

  return data ?? null
}
