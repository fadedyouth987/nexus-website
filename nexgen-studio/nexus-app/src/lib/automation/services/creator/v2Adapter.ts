import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import type { FactoryPersonaInput } from '@/lib/automation/pipeline/types'

type SupabaseAdmin = ReturnType<typeof getEngineSupabaseAdmin>

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : []
}

export type V2CreatorContext = {
  orgId: string
  workspaceId: string
}

export async function resolveV2CreatorContext(
  admin: SupabaseAdmin,
  userId: string
): Promise<V2CreatorContext | null> {
  const { data: orgMember } = await admin
    .from('org_members_v2')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!orgMember?.org_id) {
    return null
  }

  const { data: workspaceMember } = await admin
    .from('workspace_members_v2')
    .select('workspace_id')
    .eq('org_id', orgMember.org_id)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!workspaceMember?.workspace_id) {
    return null
  }

  return {
    orgId: String(orgMember.org_id),
    workspaceId: String(workspaceMember.workspace_id),
  }
}

export async function createV2Creator(
  admin: SupabaseAdmin,
  _userId: string,
  context: V2CreatorContext,
  handle: string,
  persona: FactoryPersonaInput
): Promise<string | null> {
  const { data, error } = await admin
    .from('creators_v2')
    .insert({
      org_id: context.orgId,
      workspace_id: context.workspaceId,
      name: String(persona.name || '').trim(),
      handle,
      niche: String(persona.niche || '').trim(),
      status: 'active',
      brand_profile: {
        personality: persona.personality || '',
        speech_style: persona.speech_style || '',
        catchphrases: toArray(persona.catchphrases),
        audience_type: persona.audience_type || '',
        tone: persona.tone || '',
        content_rating: persona.content_rating === 'nsfw' ? 'nsfw' : 'sfw',
      },
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    return null
  }

  return String(data.id)
}

export async function getV2CreatorById(admin: SupabaseAdmin, id: string) {
  const { data } = await admin
    .from('creators_v2')
    .select('id, org_id, workspace_id, name, handle, niche, status, created_at')
    .eq('id', id)
    .maybeSingle()

  return data ?? null
}
