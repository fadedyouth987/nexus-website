import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import { isMissingColumnError } from '@/server/supabase/errors'

export type AppSession = {
  userId: string
  email: string | null
  name: string | null
  orgId: string
}

export async function requireAppSession(): Promise<AppSession> {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id

  if (!userId) {
    const error = new Error('Unauthorized')
    ;(error as Error & { status?: number }).status = 401
    throw error
  }

  const admin = getSupabaseAdmin()

  const [v2Member, legacyMember] = await Promise.all([
    admin
      .from('org_members_v2')
      .select('org_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    getLegacyOrganizationMemberOrgId(admin, userId),
  ])

  const orgId =
    v2Member.data?.org_id ||
    legacyMember ||
    null

  if (!orgId) {
    const error = new Error('No organization membership found for this account')
    ;(error as Error & { status?: number }).status = 403
    throw error
  }

  return {
    userId,
    email: session.user?.email ?? null,
    name: session.user?.name ?? null,
    orgId,
  }
}

/**
 * Require admin role for admin-only routes
 * Checks if user has admin role in their organization
 */
export async function requireAdminRole(session: AppSession): Promise<void> {
  const admin = getSupabaseAdmin()

  // Check org_members_v2 for admin role
  const { data: member, error } = await admin
    .from('org_members_v2')
    .select('role')
    .eq('user_id', session.userId)
    .eq('org_id', session.orgId)
    .maybeSingle()

  if (error) {
    throw new Error('Failed to verify admin role')
  }

  const isAdmin = member?.role === 'admin' || member?.role === 'owner'

  if (!isAdmin) {
    const err = new Error('Admin access required')
    ;(err as Error & { status?: number }).status = 403
    throw err
  }
}

async function getLegacyOrganizationMemberOrgId(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
) {
  const legacyOrganizationId = await admin
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!legacyOrganizationId.error) {
    return legacyOrganizationId.data?.organization_id ?? null
  }

  if (!isMissingColumnError(legacyOrganizationId.error)) {
    throw legacyOrganizationId.error
  }

  const legacyOrgId = await admin
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (legacyOrgId.error) {
    throw legacyOrgId.error
  }

  return legacyOrgId.data?.org_id ?? null
}
