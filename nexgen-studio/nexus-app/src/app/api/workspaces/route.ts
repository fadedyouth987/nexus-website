import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { createClient } from '@/lib/supabase/server'
import { isPortfolioV2ServerEnabled } from '@/lib/core/featureFlags'
import { writeActivityLog } from '@/lib/server/activityLog'
import {
  AccessError,
  getServerSupabase,
  getServerUser,
  requireOrgMembership,
  requireRoleAtLeast,
} from '@/lib/server/v2Access'

function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this'
}

async function listLegacyWorkspaces(request: Request) {
  const userId = await getUserId(request)

  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient(undefined as any)
    const { data, error } = await supabase
      .from('organization_members')
      .select('role, organizations(id, name)')
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json([])
    }

    const workspaces = (data ?? []).map((row: any) => row.organizations).filter(Boolean)
    return NextResponse.json(workspaces)
  } catch {
    return NextResponse.json([])
  }
}

async function getUserId(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: getAuthSecret(),
  })

  return typeof token?.id === 'string' ? token.id : null
}

export async function GET(request: Request) {
  if (isPortfolioV2ServerEnabled()) {
    try {
      const supabase = await getServerSupabase(request)
      const user = await getServerUser(request)
      const { searchParams } = new URL(request.url)
      const org = await requireOrgMembership(request, {
        supabase,
        user,
        orgId: searchParams.get('org_id'),
      })

      const { data: workspaces, error: workspacesError } = await supabase
        .from('workspaces_v2')
        .select('id, org_id, name, client_visible, created_at')
        .eq('org_id', org.orgId)
        .order('created_at', { ascending: true })

      if (workspacesError) {
        throw new AccessError(500, 'Failed to load workspaces')
      }

      const { data: membershipRows, error: membershipError } = await supabase
        .from('workspace_members_v2')
        .select('workspace_id, role')
        .eq('org_id', org.orgId)
        .eq('user_id', user.userId)

      if (membershipError) {
        throw new AccessError(500, 'Failed to load workspace memberships')
      }

      const roleByWorkspaceId = new Map(
        (membershipRows ?? []).map((row) => [row.workspace_id, row.role])
      )

      return NextResponse.json(
        (workspaces ?? []).map((workspace) => ({
          id: workspace.id,
          org_id: workspace.org_id,
          name: workspace.name,
          client_visible: workspace.client_visible,
          created_at: workspace.created_at,
          role: roleByWorkspaceId.get(workspace.id) || org.role,
        }))
      )
    } catch (error) {
      if (typeof (error as { status?: number }).status === 'number' && (error as { status: number }).status === 403) {
        return listLegacyWorkspaces(request)
      }
      if (typeof (error as { status?: number }).status === 'number' && (error as { status: number }).status === 500) {
        return listLegacyWorkspaces(request)
      }

      const status =
        typeof (error as { status?: number }).status === 'number'
          ? (error as { status: number }).status
          : 500

      return NextResponse.json(
        { detail: error instanceof Error ? error.message : 'Failed to load workspaces' },
        { status }
      )
    }
  }

  return listLegacyWorkspaces(request)
}

export async function POST(request: Request) {
  if (isPortfolioV2ServerEnabled()) {
    try {
      const supabase = await getServerSupabase(request)
      const user = await getServerUser(request)
      const { searchParams } = new URL(request.url)
      const org = await requireOrgMembership(request, {
        supabase,
        user,
        orgId: searchParams.get('org_id'),
      })

      requireRoleAtLeast(org.role, 'admin')

      let body: { name?: string; client_visible?: boolean }
      try {
        body = await request.json()
      } catch {
        return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
      }

      const name = body.name?.trim()

      if (!name) {
        return NextResponse.json({ detail: 'name is required' }, { status: 400 })
      }

      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces_v2')
        .insert({
          org_id: org.orgId,
          name,
          client_visible: Boolean(body.client_visible),
        })
        .select('id, org_id, name, client_visible, created_at')
        .single()

      if (workspaceError || !workspace) {
        throw new AccessError(500, 'Failed to create workspace')
      }

      const { error: memberError } = await supabase.from('workspace_members_v2').insert({
        org_id: org.orgId,
        workspace_id: workspace.id,
        user_id: user.userId,
        role: org.role === 'owner' ? 'owner' : 'admin',
      })

      if (memberError) {
        throw new AccessError(500, 'Workspace created but membership bootstrap failed')
      }

      await writeActivityLog({
        supabase,
        orgId: org.orgId,
        workspaceId: workspace.id,
        actorId: user.userId,
        action: 'workspace.created',
        entityType: 'workspace',
        entityId: workspace.id,
        metadata: {
          name: workspace.name,
          client_visible: workspace.client_visible,
        },
      })

      return NextResponse.json(
        {
          ...workspace,
          role: org.role === 'owner' ? 'owner' : 'admin',
        },
        { status: 201 }
      )
    } catch (error) {
      const status =
        typeof (error as { status?: number }).status === 'number'
          ? (error as { status: number }).status
          : 500

      return NextResponse.json(
        { detail: error instanceof Error ? error.message : 'Failed to create workspace' },
        { status }
      )
    }
  }

  return NextResponse.json({ detail: 'Not found' }, { status: 404 })
}
