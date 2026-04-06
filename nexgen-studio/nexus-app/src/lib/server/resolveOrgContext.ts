import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { isMissingColumnError } from '@/server/supabase/errors'

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

  const legacy = await getLegacyOrgMembership(admin, userId)
  if (legacy?.orgId) {
    return {
      system: 'legacy',
      orgId: legacy.orgId,
      role: legacy.role,
    }
  }

  return {
    system: 'none',
    orgId: null,
    role: null,
  }
}

async function getLegacyOrgMembership(
  admin: ReturnType<typeof getEngineSupabaseAdmin>,
  userId: string
): Promise<{ orgId: string; role: OrgRole } | null> {
  const legacyOrganizationId = await admin
    .from('organization_members')
    .select('organization_id, role, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (!legacyOrganizationId.error) {
    const row = Array.isArray(legacyOrganizationId.data) ? legacyOrganizationId.data[0] : null
    if (!row?.organization_id) {
      return null
    }

    return {
      orgId: String(row.organization_id),
      role: (row.role || 'viewer') as OrgRole,
    }
  }

  if (!isMissingColumnError(legacyOrganizationId.error)) {
    throw legacyOrganizationId.error
  }

  const legacyOrgId = await admin
    .from('organization_members')
    .select('org_id, role, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (legacyOrgId.error) {
    throw legacyOrgId.error
  }

  const row = Array.isArray(legacyOrgId.data) ? legacyOrgId.data[0] : null
  if (!row?.org_id) {
    return null
  }

  return {
    orgId: String(row.org_id),
    role: (row.role || 'viewer') as OrgRole,
  }
}
