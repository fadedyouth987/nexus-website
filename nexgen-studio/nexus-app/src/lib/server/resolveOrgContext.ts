import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export type OrgSystem = 'v2' | 'legacy' | 'none'
export type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer'

export type ResolvedOrgContext = {
  system: OrgSystem
  orgId: string | null
  role: OrgRole | null
}

/**
 * Resolve organization context for the current user across v2 and legacy tables.
 * Prefer v2 when available, then fall back to legacy.
 */
export async function resolveOrgContextForUser(userId: string): Promise<ResolvedOrgContext> {
  const admin = getEngineSupabaseAdmin()

  const { data: v2Rows } = await admin
    .from('org_members_v2')
    .select('org_id, role, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  const v2 = Array.isArray(v2Rows) ? v2Rows[0] : null
  if (v2?.org_id) {
    return {
      system: 'v2',
      orgId: String(v2.org_id),
      role: (v2.role || 'viewer') as OrgRole,
    }
  }

  const { data: legacyRows } = await admin
    .from('organization_members')
    .select('organization_id, role, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  const legacy = Array.isArray(legacyRows) ? legacyRows[0] : null
  if (legacy?.organization_id) {
    return {
      system: 'legacy',
      orgId: String(legacy.organization_id),
      role: (legacy.role || 'viewer') as OrgRole,
    }
  }

  return {
    system: 'none',
    orgId: null,
    role: null,
  }
}

