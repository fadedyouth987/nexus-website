import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

type OrgRole = 'owner' | 'admin' | 'editor' | 'viewer'

async function getLegacyOrgJoinColumn(): Promise<'organization_id' | 'org_id'> {
  const admin = getEngineSupabaseAdmin()
  const { data } = await admin
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'organization_members')
  const columns = (data ?? []).map((row: any) => String(row.column_name))
  return columns.includes('organization_id') ? 'organization_id' : 'org_id'
}

export async function POST(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  const userId = typeof token?.sub === 'string' ? token.sub : null
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { token?: string }
    const inviteToken = String(body.token || '').trim()
    if (!inviteToken) {
      return NextResponse.json({ detail: 'token is required' }, { status: 400 })
    }

    const admin = getEngineSupabaseAdmin()
    const userRes = await admin.auth.admin.getUserById(userId)
    const userEmail = (userRes.data.user?.email || '').trim().toLowerCase()
    if (!userEmail) {
      return NextResponse.json({ detail: 'Your account has no email address' }, { status: 400 })
    }

    const { data: invite, error: inviteError } = await admin
      .from('org_team_invites')
      .select('id, org_id, email, role, status, expires_at')
      .eq('token', inviteToken)
      .maybeSingle()

    if (inviteError || !invite) {
      return NextResponse.json({ detail: 'Invite not found' }, { status: 404 })
    }
    if (String(invite.status) !== 'pending') {
      return NextResponse.json({ detail: 'Invite is no longer pending' }, { status: 400 })
    }
    if (invite.expires_at && new Date(String(invite.expires_at)).getTime() < Date.now()) {
      await admin.from('org_team_invites').update({ status: 'expired' }).eq('id', invite.id)
      return NextResponse.json({ detail: 'Invite has expired' }, { status: 400 })
    }
    if (String(invite.email || '').trim().toLowerCase() !== userEmail) {
      return NextResponse.json({ detail: 'Invite email does not match your account email' }, { status: 403 })
    }

    const orgId = String(invite.org_id)
    const role = (invite.role || 'viewer') as OrgRole
    const legacyOrgJoinColumn = await getLegacyOrgJoinColumn()

    const v2Existing = await admin
      .from('org_members_v2')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .maybeSingle()
    const legacyExisting = await admin
      .from('organization_members')
      .select('id')
      .eq(legacyOrgJoinColumn, orgId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!v2Existing.data) {
      const { error: v2InsertError } = await admin.from('org_members_v2').insert({
        org_id: orgId,
        user_id: userId,
        role,
      })
      if (v2InsertError && !v2InsertError.message.includes('relation') && !v2InsertError.message.includes('duplicate')) {
        return NextResponse.json({ detail: v2InsertError.message }, { status: 500 })
      }
    }

    if (!legacyExisting.data) {
      const { error: legacyInsertError } = await admin.from('organization_members').insert({
        [legacyOrgJoinColumn]: orgId,
        user_id: userId,
        role,
      })
      if (
        legacyInsertError &&
        !legacyInsertError.message.includes('relation') &&
        !legacyInsertError.message.includes('duplicate')
      ) {
        return NextResponse.json({ detail: legacyInsertError.message }, { status: 500 })
      }
    }

    await admin
      .from('org_team_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id)

    return NextResponse.json({ ok: true, orgId })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to accept invite' },
      { status: 500 }
    )
  }
}

