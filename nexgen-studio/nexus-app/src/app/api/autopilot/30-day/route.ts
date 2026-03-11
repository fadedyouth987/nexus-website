import { NextResponse } from 'next/server'
import { getEngineUser } from '@/lib/engine/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { ENGINE_AUTOPILOT_JOB, ENGINE_AUTOPILOT_QUEUE, enqueueEngineJob } from '@/lib/engine/queue'
import { createContentPlanRow } from '@/lib/engine/createContentPlanRow'
import { createQueueItemRow } from '@/lib/engine/createQueueItemRow'

type CreatePlanBody = {
  influencerId?: string
  niche?: string
  brandStyle?: string
  workspaceId?: string
}

function parseBody(value: unknown): CreatePlanBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const body = value as Record<string, unknown>
  return {
    influencerId: typeof body.influencerId === 'string' ? body.influencerId.trim() : undefined,
    niche: typeof body.niche === 'string' ? body.niche.trim() : undefined,
    brandStyle: typeof body.brandStyle === 'string' ? body.brandStyle.trim() : undefined,
    workspaceId: typeof body.workspaceId === 'string' ? body.workspaceId.trim() : undefined,
  }
}

function dayDateIso(dayIndex: number) {
  const date = new Date()
  date.setDate(date.getDate() + dayIndex)
  return date.toISOString()
}

function dayDateOnly(dayIndex: number) {
  return dayDateIso(dayIndex).slice(0, 10)
}

function buildTitle(dayIndex: number, niche: string, brandStyle: string) {
  return `Day ${dayIndex}: ${brandStyle} ${niche}`
}

function buildPrompt(dayIndex: number, niche: string, brandStyle: string, influencerName: string) {
  return [
    `Create a ${brandStyle} image concept for day ${dayIndex}.`,
    `Niche: ${niche}.`,
    `Influencer: ${influencerName}.`,
    'Return a production-ready visual with strong social-hook composition.',
  ].join(' ')
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await getEngineUser(request)
    const admin = getEngineSupabaseAdmin()

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const body = parseBody(json)
    if (!body.influencerId || !body.niche || !body.brandStyle) {
      return NextResponse.json(
        { detail: 'influencerId, niche, and brandStyle are required' },
        { status: 400 }
      )
    }

    const { data: influencer } = await admin
      .from('influencers')
      .select('id, org_id, name, display_name, handle')
      .eq('id', body.influencerId)
      .maybeSingle()

    if (!influencer) {
      return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
    }

    const { data: member } = await admin
      .from('organization_members')
      .select('id')
      .eq('user_id', authUserId)
      .eq('org_id', influencer.org_id)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
    }

    const { data: plan, error: planError } = await admin
      .from('autopilot_plans')
      .insert({
        user_id: authUserId,
        organization_id: influencer.org_id,
        workspace_id: body.workspaceId || null,
        influencer_id: body.influencerId,
        niche: body.niche,
        brand_style: body.brandStyle,
        total_days: 30,
        status: 'QUEUED',
        started_at: new Date().toISOString(),
      })
      .select('id, total_days')
      .single()

    if (planError || !plan) {
      return NextResponse.json({ detail: 'Failed to create plan' }, { status: 500 })
    }

    let queuedCount = 0
    let failedCount = 0
    const influencerName =
      influencer.display_name || influencer.name || influencer.handle || `influencer ${influencer.id}`

    for (let dayIndex = 1; dayIndex <= 30; dayIndex += 1) {
      const title = buildTitle(dayIndex, body.niche, body.brandStyle)
      const prompt = buildPrompt(dayIndex, body.niche, body.brandStyle, influencerName)
      let queueItemId: string | null = null

      try {
        const contentPlan = await createContentPlanRow({
          admin,
          influencerId: body.influencerId,
          orgId: influencer.org_id,
          theme: title,
          notes: prompt,
          date: dayDateOnly(dayIndex),
        })

        const queueItem = await createQueueItemRow({
          admin,
          table: 'autopilot_plan_items',
          parentColumn: 'plan_id',
          parentId: plan.id,
          indexColumn: 'day_index',
          indexValue: dayIndex,
          title,
          prompt,
          contentPlanId: contentPlan.id,
          scheduledFor: dayDateIso(dayIndex),
        })
        queueItemId = queueItem.id

        const queueJobId = await enqueueEngineJob({
          queueName: ENGINE_AUTOPILOT_QUEUE,
          jobName: ENGINE_AUTOPILOT_JOB,
          payload: {
            kind: 'autopilot_item',
            planItemId: queueItem.id,
          },
        })

        await admin
          .from('autopilot_plan_items')
          .update({ queue_job_id: queueJobId, error: null })
          .eq('id', queueItem.id)

        queuedCount += 1
      } catch (itemError) {
        failedCount += 1
        if (queueItemId) {
          await admin
            .from('autopilot_plan_items')
            .update({
              status: 'FAILED',
              error: itemError instanceof Error ? itemError.message : 'Failed to queue item',
            })
            .eq('id', queueItemId)
        }
      }
    }

    const finalPlanStatus = queuedCount === 0 ? 'FAILED' : 'RUNNING'

    await admin
      .from('autopilot_plans')
      .update({
        status: finalPlanStatus,
        completed_at: queuedCount === 0 ? new Date().toISOString() : null,
      })
      .eq('id', plan.id)

    return NextResponse.json({
      planId: plan.id,
      totalDays: plan.total_days,
      queuedItems: queuedCount,
      failedItems: failedCount,
      status: finalPlanStatus,
    })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to create 30-day plan' },
      { status }
    )
  }
}
