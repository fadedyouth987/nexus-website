import { createClient } from '@supabase/supabase-js'
import { getToken } from 'next-auth/jwt'

const roleOrder = ['viewer', 'editor', 'admin', 'owner'] as const

export type WorkspaceRole = (typeof roleOrder)[number]
export type AppRole = WorkspaceRole

type TokenLike = {
  id?: string
  sub?: string
  accessToken?: string
}

type UserContext = {
  userId: string
  accessToken: string
}

function requireEnvAny(names: string[]) {
  for (const name of names) {
    const value = process.env[name]
    if (value) {
      return value
    }
  }

  throw new AccessError(500, `Missing required environment variable: ${names.join(' or ')}`)
}

function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this'
}

async function getTokenFromRequest(request: Request) {
  return (await getToken({
    req: request as any,
    secret: getAuthSecret(),
  })) as TokenLike | null
}

function getRoleRank(role: WorkspaceRole) {
  return roleOrder.indexOf(role)
}

export class AccessError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function getServerSupabase(request: Request) {
  const token = await getTokenFromRequest(request)
  const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null

  return createClient(
    requireEnvAny(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']),
    requireEnvAny(['NEXT_PUBLIC_SUPABASE_ANON_KEY']),
    accessToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      : undefined
  )
}

export async function getServerUser(request: Request) {
  const token = await getTokenFromRequest(request)
  const userId = typeof token?.id === 'string' ? token.id : typeof token?.sub === 'string' ? token.sub : null
  const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null

  if (!userId || !accessToken) {
    throw new AccessError(401, 'Unauthorized')
  }

  return {
    userId,
    accessToken,
  } satisfies UserContext
}

export async function requireOrgMembership(
  request: Request,
  opts: {
    user?: UserContext
    supabase?: any
    orgId?: string | null
  } = {}
) {
  const supabase = opts.supabase ?? (await getServerSupabase(request))
  const orgId = opts.orgId ?? null

  let query = supabase
    .from('org_members_v2')
    .select('id, org_id, role, created_at')
    .order('created_at', { ascending: true })
    .limit(1)

  if (orgId) {
    query = query.eq('org_id', orgId)
  }

  const { data, error } = await query

  if (error) {
    throw new AccessError(500, 'Failed to resolve organization access')
  }

  const membership = Array.isArray(data) ? data[0] : null

  if (!membership) {
    throw new AccessError(403, 'Organization access denied')
  }

  return {
    membershipId: membership.id as string,
    orgId: membership.org_id as string,
    role: membership.role as WorkspaceRole,
  }
}

export async function requireWorkspaceAccess(
  request: Request,
  opts: {
    user?: UserContext
    supabase?: any
    orgId: string
    workspaceId?: string | null
    minimumRole?: WorkspaceRole
  }
) {
  const supabase = opts.supabase ?? (await getServerSupabase(request))
  const requestedWorkspaceId = opts.workspaceId ?? null

  let membershipQuery = supabase
    .from('workspace_members_v2')
    .select('workspace_id, role, created_at')
    .eq('org_id', opts.orgId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (requestedWorkspaceId) {
    membershipQuery = membershipQuery.eq('workspace_id', requestedWorkspaceId)
  }

  const { data: membershipRows, error: membershipError } = await membershipQuery

  if (membershipError) {
    throw new AccessError(500, 'Failed to resolve workspace membership')
  }

  const membership = Array.isArray(membershipRows) ? membershipRows[0] : null

  if (!membership) {
    throw new AccessError(403, 'Workspace access denied')
  }

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces_v2')
    .select('id, org_id, name, client_visible')
    .eq('id', membership.workspace_id)
    .eq('org_id', opts.orgId)
    .maybeSingle()

  if (workspaceError) {
    throw new AccessError(500, 'Failed to load workspace')
  }

  if (!workspace) {
    throw new AccessError(403, 'Workspace access denied')
  }

  const role = membership.role as WorkspaceRole

  if (opts.minimumRole) {
    requireRoleAtLeast(role, opts.minimumRole)
  }

  return {
    orgId: workspace.org_id as string,
    workspaceId: workspace.id as string,
    workspaceName: workspace.name as string,
    clientVisible: Boolean(workspace.client_visible),
    role,
  }
}

export function requireRoleAtLeast(role: WorkspaceRole, minimumRole: WorkspaceRole) {
  const currentRank = getRoleRank(role)
  const minimumAllowedRank = getRoleRank(minimumRole)

  if (currentRank < minimumAllowedRank) {
    throw new AccessError(403, 'Insufficient role for this action')
  }
}

export function requireRole(role: WorkspaceRole, allowedRoles: WorkspaceRole[]) {
  if (!allowedRoles.length) {
    throw new AccessError(500, 'No allowed roles provided')
  }

  const minimumAllowedRank = Math.min(...allowedRoles.map((allowedRole) => getRoleRank(allowedRole)))
  requireRoleAtLeast(role, roleOrder[minimumAllowedRank])
}

export const requireUser = getServerUser
export const requireOrg = requireOrgMembership
