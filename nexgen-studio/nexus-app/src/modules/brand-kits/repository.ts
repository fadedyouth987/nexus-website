import type { AppSession } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import { isMissingRelationError } from '@/server/supabase/errors'
import type { BrandKitRecord, CreateBrandKitInput } from './types'

const TABLE = 'brand_kits'

export async function listBrandKits(session: AppSession): Promise<BrandKitRecord[]> {
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

  return ((data ?? []) as Array<Record<string, unknown>>).map((item) => ({
    ...item,
    palette: Array.isArray(item.palette) ? item.palette.map(String) : [],
    typography: Array.isArray(item.typography) ? item.typography.map(String) : [],
  })) as BrandKitRecord[]
}

export async function createBrandKit(session: AppSession, input: CreateBrandKitInput): Promise<BrandKitRecord> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .insert({
      org_id: session.orgId,
      project_id: input.projectId ?? null,
      created_by: session.userId,
      name: input.name,
      tone: input.tone ?? null,
      palette: input.palette ?? [],
      typography: input.typography ?? [],
      voice_guidelines: input.voiceGuidelines ?? null,
    })
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return {
    ...(data as Record<string, unknown>),
    palette: Array.isArray(data.palette) ? data.palette.map(String) : [],
    typography: Array.isArray(data.typography) ? data.typography.map(String) : [],
  } as BrandKitRecord
}

export async function getBrandKitById(session: AppSession, brandKitId: string): Promise<BrandKitRecord | null> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('id', brandKitId)
    .eq('org_id', session.orgId)
    .maybeSingle()

  if (isMissingRelationError(error)) {
    return null
  }

  if (error) {
    throw error
  }

  if (!data) {
    return null
  }

  return {
    ...(data as Record<string, unknown>),
    palette: Array.isArray(data.palette) ? data.palette.map(String) : [],
    typography: Array.isArray(data.typography) ? data.typography.map(String) : [],
  } as BrandKitRecord
}

export async function updateBrandKit(
  session: AppSession,
  brandKitId: string,
  input: CreateBrandKitInput
): Promise<BrandKitRecord> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .update({
      project_id: input.projectId ?? null,
      name: input.name,
      tone: input.tone ?? null,
      palette: input.palette ?? [],
      typography: input.typography ?? [],
      voice_guidelines: input.voiceGuidelines ?? null,
    })
    .eq('id', brandKitId)
    .eq('org_id', session.orgId)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return {
    ...(data as Record<string, unknown>),
    palette: Array.isArray(data.palette) ? data.palette.map(String) : [],
    typography: Array.isArray(data.typography) ? data.typography.map(String) : [],
  } as BrandKitRecord
}
