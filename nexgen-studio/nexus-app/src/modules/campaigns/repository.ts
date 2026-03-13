import type { AppSession } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import { isMissingRelationError } from '@/server/supabase/errors'
import type { CampaignRecord, CreateCampaignInput, UpdateCampaignInput } from './types'

const TABLE = 'campaigns'

export async function listCampaigns(session: AppSession): Promise<CampaignRecord[]> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('org_id', session.orgId)
    .order('updated_at', { ascending: false })

  if (isMissingRelationError(error)) {
    return []
  }

  if (error) {
    throw error
  }

  return (data ?? []) as CampaignRecord[]
}

export async function createCampaign(session: AppSession, input: CreateCampaignInput): Promise<CampaignRecord> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .insert({
      org_id: session.orgId,
      created_by: session.userId,
      project_id: input.projectId ?? null,
      brand_kit_id: input.brandKitId ?? null,
      name: input.name,
      brief: input.brief,
      channel: input.channel ?? null,
      objective: input.objective ?? null,
      status: input.status ?? 'draft',
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as CampaignRecord
}

export async function getCampaignById(session: AppSession, campaignId: string): Promise<CampaignRecord | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('id', campaignId)
    .eq('org_id', session.orgId)
    .maybeSingle()

  if (isMissingRelationError(error)) {
    return null
  }

  if (error) {
    throw error
  }

  return (data as CampaignRecord | null) ?? null
}

export async function updateCampaign(
  session: AppSession,
  campaignId: string,
  input: UpdateCampaignInput
): Promise<CampaignRecord> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .update({
      project_id: input.projectId ?? null,
      brand_kit_id: input.brandKitId ?? null,
      name: input.name,
      brief: input.brief,
      channel: input.channel ?? null,
      objective: input.objective ?? null,
      status: input.status,
    })
    .eq('id', campaignId)
    .eq('org_id', session.orgId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data as CampaignRecord
}
