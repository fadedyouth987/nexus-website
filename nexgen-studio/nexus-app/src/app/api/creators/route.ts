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
  requireWorkspaceAccess,
} from '@/lib/server/v2Access'

type CreatorInsert = {
  user_id: string
  name: string
  handle: string
  niche: string
  bio: string
  style_template: string
  vault_mode: 'sfw' | 'nsfw'
  status: string
}

function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this'
}

async function getUserId(request: Request) {
  const token = await getToken({ req: request as any, secret: getAuthSecret() })
  return typeof token?.id === 'string' ? token.id : null
}

function normalizeVaultMode(value: unknown): 'sfw' | 'nsfw' {
  return value === 'nsfw' ? 'nsfw' : 'sfw'
}

async function debugLog(
  hypothesisId: string,
  message: string,
  data: Record<string, unknown> = {},
  runId = 'run3'
) {
  // #region agent log
  await fetch('http://127.0.0.1:7810/ingest/e1fb0ad9-95e8-422a-bd38-81f121a8c64c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a5e906'},body:JSON.stringify({sessionId:'a5e906',runId,hypothesisId,location:'src/app/api/creators/route.ts',message,data,timestamp:Date.now()})}).catch(()=>{})
  // #endregion
}

export async function GET(request: Request) {
  if (isPortfolioV2ServerEnabled()) {
    try {
      const { searchParams } = new URL(request.url)
      await debugLog('H4', 'creators:get:start', {
        portfolioV2: true,
        org_id: searchParams.get('org_id') ?? null,
        workspace_id: searchParams.get('workspace_id') ?? null,
      })

      const supabase = await getServerSupabase(request)
      const user = await getServerUser(request)
      const org = await requireOrgMembership(request, {
        supabase,
        user,
        orgId: searchParams.get('org_id'),
      })
      const workspace = await requireWorkspaceAccess(request, {
        supabase,
        user,
        orgId: org.orgId,
        workspaceId: searchParams.get('workspace_id'),
      })

      const { data, error } = await supabase
        .from('creators_v2')
        .select('id, name, handle, niche, status, created_at')
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId)
        .order('created_at', { ascending: false })

      if (error) {
        throw new AccessError(500, 'Failed to load creators')
      }

      await debugLog('H4', 'creators:get:success', {
        org_id: org.orgId,
        workspace_id: workspace.workspaceId,
        count: (data ?? []).length,
      })

      return NextResponse.json({
        items: data ?? [],
        meta: {
          org_id: org.orgId,
          workspace_id: workspace.workspaceId,
          workspace_name: workspace.workspaceName,
          role: workspace.role,
          client_visible: workspace.clientVisible,
        },
      })
    } catch (error) {
      const status =
        typeof (error as { status?: number }).status === 'number'
          ? (error as { status: number }).status
          : 500

      await debugLog('H4', 'creators:get:error', {
        status,
        message: error instanceof Error ? error.message : 'unknown',
      })

      return NextResponse.json(
        { detail: error instanceof Error ? error.message : 'Failed to load creators' },
        { status }
      )
    }
  }

  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const vaultMode = searchParams.get('vault_mode')
  const supabase = await createClient()

  let query = supabase
    .from('creators')
    .select('id, name, handle, niche, bio, style_template, vault_mode, status, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (vaultMode === 'sfw' || vaultMode === 'nsfw') {
    query = query.eq('vault_mode', vaultMode)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ detail: 'Failed to load creators' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
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
      const workspace = await requireWorkspaceAccess(request, {
        supabase,
        user,
        orgId: org.orgId,
        workspaceId: searchParams.get('workspace_id'),
      })

      requireRoleAtLeast(workspace.role, 'editor')

      let body: Partial<CreatorInsert>
      try {
        body = await request.json()
      } catch {
        return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
      }

      const name = body.name?.trim()

      if (!name) {
        return NextResponse.json({ detail: 'name is required' }, { status: 400 })
      }

      const { data, error } = await supabase
        .from('creators_v2')
        .insert({
          org_id: org.orgId,
          workspace_id: workspace.workspaceId,
          name,
          handle: body.handle?.trim() || null,
          niche: body.niche?.trim() || null,
          status: body.status?.trim() || 'active',
        })
        .select('id, name, handle, niche, status, created_at')
        .single()

      if (error) {
        throw new AccessError(500, 'Failed to create creator')
      }

      await writeActivityLog({
        supabase,
        orgId: org.orgId,
        workspaceId: workspace.workspaceId,
        actorId: user.userId,
        action: 'creator.created',
        entityType: 'creator',
        entityId: data.id,
        metadata: {
          name: data.name,
          status: data.status,
        },
      })

      return NextResponse.json(data, { status: 201 })
    } catch (error) {
      const status =
        typeof (error as { status?: number }).status === 'number'
          ? (error as { status: number }).status
          : 500

      return NextResponse.json(
        { detail: error instanceof Error ? error.message : 'Failed to create creator' },
        { status }
      )
    }
  }

  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<CreatorInsert>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
  }

  const name = body.name?.trim()
  const handle = body.handle?.trim()
  const niche = body.niche?.trim()

  if (!name || !handle || !niche) {
    return NextResponse.json(
      { detail: 'name, handle, and niche are required' },
      { status: 400 }
    )
  }

  const payload: CreatorInsert = {
    user_id: userId,
    name,
    handle,
    niche,
    bio: body.bio?.trim() ?? '',
    style_template: body.style_template?.trim() || 'default',
    vault_mode: normalizeVaultMode(body.vault_mode),
    status: body.status?.trim() || 'active',
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('creators')
    .insert(payload)
    .select('id, name, handle, niche, bio, style_template, vault_mode, status, created_at')
    .single()

  if (error) {
    const status = error.code === '23505' ? 409 : 500
    const detail = status === 409 ? 'A creator with that handle already exists' : 'Failed to create creator'
    return NextResponse.json({ detail }, { status })
  }

  return NextResponse.json(data, { status: 201 })
}
