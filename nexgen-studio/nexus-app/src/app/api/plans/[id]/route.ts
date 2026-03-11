import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

const PLANS = 'planner_plans'
const PLAN_BRIEFS = 'planner_plan_briefs'
const STRATEGY_PROFILES = 'planner_strategy_profiles'

async function getUserId(request: Request): Promise<string | null> {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })
  return (typeof token?.sub === 'string' ? token.sub : null) ?? (typeof token?.id === 'string' ? token.id : null)
}

export async function GET(
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

    const { data: plan, error: planError } = await admin
      .from(PLANS)
      .select('*')
      .eq('id', planId)
      .eq('user_id', userId)
      .maybeSingle()

    if (planError || !plan) {
      return NextResponse.json({ detail: 'Plan not found' }, { status: 404 })
    }

    const [briefRes, strategyRes] = await Promise.all([
      admin.from(PLAN_BRIEFS).select('*').eq('plan_id', planId).maybeSingle(),
      admin.from(STRATEGY_PROFILES).select('*').eq('plan_id', planId).maybeSingle(),
    ])

    return NextResponse.json({
      plan,
      brief: briefRes.data ?? null,
      strategy: strategyRes.data ?? null,
    })
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Failed to load plan' },
      { status: 500 }
    )
  }
}
