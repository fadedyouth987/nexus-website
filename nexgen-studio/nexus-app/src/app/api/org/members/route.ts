import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { resolveOrgContextForUser, type OrgRole } from '@/lib/server/resolveOrgContext'

type TeamMember = {
  id: string
  userId: string
  role: OrgRole
  email: string | null
  name: string | null
  createdAt: string | null
}

async function getLegacyOrgJoinColumn(): Promise<'organization_id' | 'org_id' | null> {
  const admin = getEngineSupabaseAdmin()
  const { data, error } = await admin
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'organization_members')

  if (error) {
    // #region agent log
    fetch('http://127.0.0.1:7580/ingest/7abdc497-7312-45d7-898f-315f024f177d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'86823d'},body:JSON.stringify({sessionId:'86823d',runId:'pre-fix',hypothesisId:'H3',location:'src/app/api/org/members/route.ts:getLegacyOrgJoinColumn:error',message:'Failed to inspect organization_members columns',data:{error:error.message},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return null
  }

  const columns = (data ?? []).map((row: any) => String(row.column_name))
  // #region agent log
  fetch('http://127.0.0.1:7580/ingest/7abdc497-7312-45d7-898f-315f024f177d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'86823d'},body:JSON.stringify({sessionId:'86823d',runId:'pre-fix',hypothesisId:'H1',location:'src/app/api/org/members/route.ts:getLegacyOrgJoinColumn:columns',message:'Detected organization_members columns',data:{columns},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (columns.includes('organization_id')) return 'organization_id'
  if (columns.includes('org_id')) return 'org_id'
  return null
}

function canManageTeam(role: OrgRole | null) {
  return role === 'owner' || role === 'admin'
}

async function requireUserId(request: Request): Promise<string | null> {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  return typeof token?.sub === 'string' ? token.sub : null
}

async function getUserIdentityMap(userIds: string[]): Promise<Map<string, { email: string | null; name: string | null }>> {
  const admin = getEngineSupabaseAdmin()
  const map = new Map<string, { email: string | null; name: string | null }>()
  const unique = [...new Set(userIds.filter(Boolean))]
  await Promise.all(
    unique.map(async (userId) => {
      try {
        const res = await admin.auth.admin.getUserById(userId)
        const user = res.data.user
        map.set(userId, {
          email: user?.email ?? null,
          name: (user?.user_metadata?.name as string | undefined) ?? null,
        })
      } catch {
        map.set(userId, { email: null, name: null })
      }
    })
  )
  return map
}

export async function GET(request: Request) {
  const userId = await requireUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = getEngineSupabaseAdmin()
    const context = await resolveOrgContextForUser(userId)
    const legacyOrgJoinColumn = await getLegacyOrgJoinColumn()
    // #region agent log
    fetch('http://127.0.0.1:7580/ingest/7abdc497-7312-45d7-898f-315f024f177d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'86823d'},body:JSON.stringify({sessionId:'86823d',runId:'pre-fix',hypothesisId:'H2',location:'src/app/api/org/members/route.ts:GET:context',message:'Resolved org context and legacy join column',data:{system:context.system,orgId:context.orgId,role:context.role,legacyOrgJoinColumn},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    if (!context.orgId) {
      const identities = await getUserIdentityMap([userId])
      const me = identities.get(userId)
      return NextResponse.json({
        mode: 'solo',
        org: null,
        role: 'owner',
        members: [
          {
            id: `solo-${userId}`,
            userId,
            role: 'owner',
            email: me?.email ?? null,
            name: me?.name ?? 'You',
            createdAt: null,
          },
        ],
        invites: [],
      })
    }

    const orgQuery =
      context.system === 'v2'
        ? admin.from('organizations').select('id, name').eq('id', context.orgId).maybeSingle()
        : admin.from('organizations').select('id, name').eq('id', context.orgId).maybeSingle()
    const { data: org } = await orgQuery

    const memberRows =
      context.system === 'v2'
        ? await admin
            .from('org_members_v2')
            .select('id, user_id, role, created_at')
            .eq('org_id', context.orgId)
            .order('created_at', { ascending: true })
        : await admin
            .from('organization_members')
            .select('id, user_id, role, created_at')
            .eq(legacyOrgJoinColumn || 'organization_id', context.orgId)
            .order('created_at', { ascending: true })

    if (memberRows.error) {
      return NextResponse.json({ detail: memberRows.error.message }, { status: 500 })
    }

    const rows = memberRows.data ?? []
    const identities = await getUserIdentityMap(rows.map((r: any) => String(r.user_id)))
    const members: TeamMember[] = rows.map((r: any) => {
      const identity = identities.get(String(r.user_id))
      return {
        id: String(r.id),
        userId: String(r.user_id),
        role: (r.role || 'viewer') as OrgRole,
        email: identity?.email ?? null,
        name: identity?.name ?? null,
        createdAt: r.created_at ? String(r.created_at) : null,
      }
    })

    let invites: Array<{
      id: string
      email: string
      role: OrgRole
      status: string
      token: string | null
      createdAt: string
      expiresAt: string | null
    }> = []
    const inviteResult = await admin
      .from('org_team_invites')
      .select('id, email, role, status, token, created_at, expires_at')
      .eq('org_id', context.orgId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!inviteResult.error && Array.isArray(inviteResult.data)) {
      invites = inviteResult.data.map((row: any) => ({
        id: String(row.id),
        email: String(row.email),
        role: (row.role || 'viewer') as OrgRole,
        status: String(row.status || 'pending'),
        token: canManageTeam(context.role) ? String(row.token || '') : null,
        createdAt: String(row.created_at),
        expiresAt: row.expires_at ? String(row.expires_at) : null,
      }))
    }

    return NextResponse.json({
      mode: 'organization',
      org: org ? { id: org.id, name: org.name } : { id: context.orgId, name: 'Organization' },
      role: context.role,
      members,
      invites,
    })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load team members' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const userId = await requireUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const context = await resolveOrgContextForUser(userId)
    if (!context.orgId) {
      return NextResponse.json(
        { detail: 'Create or join an organization to invite teammates.' },
        { status: 400 }
      )
    }
    if (!canManageTeam(context.role)) {
      return NextResponse.json({ detail: 'Insufficient role for invites' }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      role?: OrgRole
    }
    const email = String(body.email || '').trim().toLowerCase()
    const role = (body.role || 'viewer') as OrgRole
    if (!email || !email.includes('@')) {
      return NextResponse.json({ detail: 'Valid email is required' }, { status: 400 })
    }
    if (!['owner', 'admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ detail: 'Invalid role' }, { status: 400 })
    }
    if (role === 'owner' && context.role !== 'owner') {
      return NextResponse.json({ detail: 'Only owners can invite other owners' }, { status: 403 })
    }

    const admin = getEngineSupabaseAdmin()
    const { data: existingPending } = await admin
      .from('org_team_invites')
      .select('id')
      .eq('org_id', context.orgId)
      .eq('email', email)
      .eq('status', 'pending')
      .maybeSingle()

    if (existingPending?.id) {
      return NextResponse.json({ detail: 'Invite already pending for this email.' }, { status: 409 })
    }

    const { error } = await admin.from('org_team_invites').insert({
      org_id: context.orgId,
      email,
      role,
      status: 'pending',
      invited_by_user_id: userId,
      token: crypto.randomUUID(),
    })

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to create invite' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const userId = await requireUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const context = await resolveOrgContextForUser(userId)
    if (!context.orgId || !canManageTeam(context.role)) {
      return NextResponse.json({ detail: 'Insufficient role for team updates' }, { status: 403 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      memberId?: string
      role?: OrgRole
    }
    const memberId = String(body.memberId || '').trim()
    const nextRole = body.role as OrgRole

    if (!memberId) {
      return NextResponse.json({ detail: 'memberId is required' }, { status: 400 })
    }
    if (!['owner', 'admin', 'editor', 'viewer'].includes(nextRole)) {
      return NextResponse.json({ detail: 'Invalid role' }, { status: 400 })
    }
    if (nextRole === 'owner' && context.role !== 'owner') {
      return NextResponse.json({ detail: 'Only owners can assign owner role' }, { status: 403 })
    }

    const admin = getEngineSupabaseAdmin()
    const table = context.system === 'v2' ? 'org_members_v2' : 'organization_members'
    const legacyOrgJoinColumn = await getLegacyOrgJoinColumn()
    const orgKey = context.system === 'v2' ? 'org_id' : legacyOrgJoinColumn || 'organization_id'

    const memberRes = await admin
      .from(table)
      .select(`id, user_id, role, ${orgKey}`)
      .eq('id', memberId)
      .eq(orgKey, context.orgId)
      .maybeSingle()

    if (memberRes.error || !memberRes.data) {
      return NextResponse.json({ detail: 'Member not found' }, { status: 404 })
    }

    if (memberRes.data.role === 'owner' && context.role !== 'owner') {
      return NextResponse.json({ detail: 'Only owners can change owner roles' }, { status: 403 })
    }

    if (memberRes.data.role === 'owner' && nextRole !== 'owner') {
      const ownerCountRes = await admin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq(orgKey, context.orgId)
        .eq('role', 'owner')
      const ownerCount = ownerCountRes.count ?? 0
      if (ownerCount <= 1) {
        return NextResponse.json({ detail: 'Cannot demote the last owner' }, { status: 400 })
      }
    }

    const { error } = await admin
      .from(table)
      .update({ role: nextRole })
      .eq('id', memberId)
      .eq(orgKey, context.orgId)

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to update member role' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const userId = await requireUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const context = await resolveOrgContextForUser(userId)
    if (!context.orgId || !canManageTeam(context.role)) {
      return NextResponse.json({ detail: 'Insufficient role for member removal' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const memberId = String(searchParams.get('memberId') || '').trim()
    const inviteId = String(searchParams.get('inviteId') || '').trim()
    if (!memberId && !inviteId) {
      return NextResponse.json({ detail: 'memberId or inviteId is required' }, { status: 400 })
    }

    const admin = getEngineSupabaseAdmin()

    if (inviteId) {
      const { error: inviteError } = await admin
        .from('org_team_invites')
        .update({ status: 'revoked' })
        .eq('id', inviteId)
        .eq('org_id', context.orgId)
        .eq('status', 'pending')
      if (inviteError) {
        return NextResponse.json({ detail: inviteError.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true })
    }
    const table = context.system === 'v2' ? 'org_members_v2' : 'organization_members'
    const legacyOrgJoinColumn = await getLegacyOrgJoinColumn()
    const orgKey = context.system === 'v2' ? 'org_id' : legacyOrgJoinColumn || 'organization_id'

    const memberRes = await admin
      .from(table)
      .select(`id, role, ${orgKey}`)
      .eq('id', memberId)
      .eq(orgKey, context.orgId)
      .maybeSingle()
    if (!memberRes.data) {
      return NextResponse.json({ detail: 'Member not found' }, { status: 404 })
    }

    if (memberRes.data.role === 'owner') {
      const ownerCountRes = await admin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq(orgKey, context.orgId)
        .eq('role', 'owner')
      const ownerCount = ownerCountRes.count ?? 0
      if (ownerCount <= 1) {
        return NextResponse.json({ detail: 'Cannot remove the last owner' }, { status: 400 })
      }
      if (context.role !== 'owner') {
        return NextResponse.json({ detail: 'Only owners can remove owners' }, { status: 403 })
      }
    }

    const { error } = await admin.from(table).delete().eq('id', memberId).eq(orgKey, context.orgId)
    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to remove member' },
      { status: 500 }
    )
  }
}

