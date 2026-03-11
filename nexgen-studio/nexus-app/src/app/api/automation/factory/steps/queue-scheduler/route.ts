import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { runPipeline } from '@/lib/automation/pipeline/runner'
import { queueToSchedulerStep } from '@/lib/automation/pipeline/steps/queueToScheduler'
import { createInfluencerPipelineContext } from '@/lib/automation/orchestrators/influencerFactory'

type QueueSchedulerPayload = {
  planId?: string
  orgId?: string
  workspaceId?: string
  creatorId?: string
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    const body = (await request.json().catch(() => ({}))) as QueueSchedulerPayload
    const planId = String(body.planId || '').trim()

    if (!planId) {
      return NextResponse.json({ detail: 'planId is required' }, { status: 400 })
    }

    const admin = getEngineSupabaseAdmin()
    const { data: plan } = await admin
      .from('planner_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', authUserId)
      .maybeSingle()

    if (!plan) {
      return NextResponse.json({ detail: 'Plan not found' }, { status: 404 })
    }

    let orgId = String(body.orgId || '').trim()
    let workspaceId = String(body.workspaceId || '').trim()
    let creatorId = String(body.creatorId || '').trim()

    if (!orgId) {
      const { data: orgMembership } = await admin
        .from('org_members_v2')
        .select('org_id')
        .eq('user_id', authUserId)
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
        .eq('user_id', authUserId)
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

    const result = await runPipeline(
      [queueToSchedulerStep()],
      createInfluencerPipelineContext(authUserId, {}, {
        planId,
        creator: {
          id: creatorId,
          mode: 'v2',
          orgId,
          workspaceId,
        },
      })
    )

    return NextResponse.json({
      ok: true,
      planId,
      ...result.context.schedulerQueue,
      reports: result.reports.map((report) => ({ name: report.name, status: report.status })),
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Queue scheduler step failed' },
      { status }
    )
  }
}
