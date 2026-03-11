import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { createPlan, generateCalendar, generateStrategy, saveBrief } from '@/lib/planner/actions'
import type { PlanBriefInput } from '@/lib/planner/types'

type MvpPlanBody = {
  planName?: string
  niche?: string
  contentGoal?: string
  audience?: string
  platforms?: string[]
  postingFrequencyPerDay?: number
  tone?: string
  visualStyle?: string
  monetizationGoal?: string
  constraints?: string
  timezone?: string
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().slice(0, maxLength)
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)

    let body: MvpPlanBody
    try {
      const parsed = await request.json()
      body =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as MvpPlanBody)
          : {}
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const niche = normalizeText(body.niche, 200)
    const contentGoal = normalizeText(body.contentGoal, 2000)
    const planName = normalizeText(body.planName, 160)
    const audience = normalizeText(body.audience, 300)
    const tone = normalizeText(body.tone, 200)
    const visualStyle = normalizeText(body.visualStyle, 300)
    const monetizationGoal = normalizeText(body.monetizationGoal, 400)
    const constraints = normalizeText(body.constraints, 2000)
    const timezone = normalizeText(body.timezone, 80) || 'UTC'

    if (!niche || !contentGoal) {
      return NextResponse.json(
        { detail: 'niche and contentGoal are required' },
        { status: 400 }
      )
    }

    const platforms = Array.isArray(body.platforms)
      ? body.platforms
          .map((platform) => normalizeText(platform, 80).toLowerCase())
          .filter(Boolean)
      : []

    const postingFrequencyPerDay =
      typeof body.postingFrequencyPerDay === 'number' && Number.isFinite(body.postingFrequencyPerDay)
        ? Math.max(1, Math.min(10, Math.floor(body.postingFrequencyPerDay)))
        : 1

    const { planId } = await createPlan(authUserId, {
      name: planName || `${niche} 30-day plan`,
      timezone,
    })

    const brief: PlanBriefInput = {
      niche,
      tone: tone || undefined,
      audience_json: audience ? [audience] : undefined,
      platforms_json: platforms.length > 0 ? platforms : undefined,
      posting_frequency_json: { per_day: postingFrequencyPerDay },
      monetization_goal: monetizationGoal || contentGoal,
      visual_style: visualStyle || undefined,
      constraints_json: {
        content_goal: contentGoal,
        constraints: constraints || null,
      },
    }

    await saveBrief(planId, brief)
    await generateStrategy(planId)
    const items = await generateCalendar(planId, 30)

    const admin = getEngineSupabaseAdmin()
    await admin.from('mvp_events').insert({
      event_name: 'plan_generated',
      user_id: authUserId,
      plan_id: planId,
      path: '/onboarding',
      user_agent: request.headers.get('user-agent') || null,
      metadata_json: {
        niche,
        content_goal: contentGoal,
        platforms,
        posting_frequency_per_day: postingFrequencyPerDay,
        item_count: items.length,
      },
    })

    return NextResponse.json({
      planId,
      count: items.length,
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to generate plan' },
      { status }
    )
  }
}
