import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { queuePlannerToScheduler } from '@/lib/automation/queuePlannerToScheduler'

async function getUserId(request: Request): Promise<string | null> {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })
  return (typeof token?.sub === 'string' ? token.sub : null) ?? (typeof token?.id === 'string' ? token.id : null)
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getUserId(request)
    if (!userId) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }

    const { id: planId } = await context.params
    const body = (await request.json().catch(() => ({}))) as {
      orgId?: string
      workspaceId?: string
      creatorId?: string
    }
    let orgId = String(body.orgId || '').trim()
    let workspaceId = String(body.workspaceId || '').trim()
    let creatorId = String(body.creatorId || '').trim()

    const admin = getEngineSupabaseAdmin()
    const { data: plan } = await admin
      .from('planner_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!plan) {
      return NextResponse.json({ detail: 'Plan not found' }, { status: 404 })
    }

    if (!orgId) {
      const { data: orgMembership } = await admin
        .from('org_members_v2')
        .select('org_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      orgId = String(orgMembership?.org_id || '')
    }
    if (!orgId) {
      return NextResponse.json({ detail: 'No organization found for user' }, { status: 400 })
    }

    if (!workspaceId) {
      const { data: workspaceMembership } = await admin
        .from('workspace_members_v2')
        .select('workspace_id')
        .eq('org_id', orgId)
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      workspaceId = String(workspaceMembership?.workspace_id || '')
    }
    if (!workspaceId) {
      return NextResponse.json({ detail: 'No workspace found for user organization' }, { status: 400 })
    }

    if (!creatorId) {
      const { data: creatorRow } = await admin
        .from('creators_v2')
        .select('id')
        .eq('org_id', orgId)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      creatorId = String(creatorRow?.id || '')
    }
    if (!creatorId) {
      return NextResponse.json({ detail: 'No creator found in target workspace' }, { status: 400 })
    }

    const { data: creator } = await admin
      .from('creators_v2')
      .select('id')
      .eq('id', creatorId)
      .eq('org_id', orgId)
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    if (!creator) {
      return NextResponse.json({ detail: 'Creator not found for org/workspace' }, { status: 404 })
    }

    const queued = await queuePlannerToScheduler({
      userId,
      planId,
      orgId,
      workspaceId,
      creatorId,
    })
    return NextResponse.json({
      ok: true,
      planId,
      ...queued,
    })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to queue planner items' },
      { status: 500 }
    )
  }
}

