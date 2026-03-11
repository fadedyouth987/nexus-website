import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { saveBrief } from '@/lib/planner/actions'
import type { PlanBriefInput } from '@/lib/planner/types'

const PLANS = 'planner_plans'

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
    const admin = getEngineSupabaseAdmin()

    const { data: plan } = await admin
      .from(PLANS)
      .select('id')
      .eq('id', planId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!plan) {
      return NextResponse.json({ detail: 'Plan not found' }, { status: 404 })
    }

    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 })
    }

    const brief: PlanBriefInput = {
      niche: typeof body.niche === 'string' ? body.niche : undefined,
      tone: typeof body.tone === 'string' ? body.tone : undefined,
      audience_json: Array.isArray(body.audience) ? body.audience : Array.isArray(body.audience_json) ? body.audience_json : undefined,
      platforms_json: Array.isArray(body.platforms) ? body.platforms : Array.isArray(body.platforms_json) ? body.platforms_json : undefined,
      posting_frequency_json: body.posting_frequency && typeof body.posting_frequency === 'object' ? body.posting_frequency as Record<string, unknown> : body.posting_frequency_json && typeof body.posting_frequency_json === 'object' ? body.posting_frequency_json as Record<string, unknown> : undefined,
      monetization_goal: typeof body.monetization_goal === 'string' ? body.monetization_goal : undefined,
      visual_style: typeof body.visual_style === 'string' ? body.visual_style : undefined,
      constraints_json: body.constraints && typeof body.constraints === 'object' ? body.constraints as Record<string, unknown> : undefined,
    }

    await saveBrief(planId, brief)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Failed to save brief' },
      { status: 500 }
    )
  }
}
