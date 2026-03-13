import type { AppSession } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import type { GeneratedAssetRecord } from './types'

export async function listAssets(session: AppSession): Promise<GeneratedAssetRecord[]> {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('generated_assets')
    .select('id, generation_job_id, organization_id, influencer_id, storage_url, kind, mime_type, created_at')
    .eq('organization_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    throw error
  }

  return (data ?? []) as GeneratedAssetRecord[]
}
