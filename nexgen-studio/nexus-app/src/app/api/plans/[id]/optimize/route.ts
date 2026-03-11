import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

type RankedItem = { contentId: string; hook: string; cta: string; platform: string; score: number }

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
      .from('planner_plans')
      .select('id')
      .eq('id', planId)
      .eq('user_id', userId)
      .maybeSingle()
    if (!plan) {
      return NextResponse.json({ detail: 'Plan not found' }, { status: 404 })
    }

    const { data: strategyRow } = await admin
      .from('planner_strategy_profiles')
      .select('id, brand_rules_json')
      .eq('plan_id', planId)
      .maybeSingle()
    if (!strategyRow?.id) {
      return NextResponse.json({ detail: 'Plan has no strategy profile to optimize' }, { status: 400 })
    }

    const { data: contentRows, error: contentError } = await admin
      .from('content_v2')
      .select('id, data')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(500)
    if (contentError) {
      return NextResponse.json({ detail: contentError.message }, { status: 500 })
    }

    const linkedContent = (contentRows ?? []).filter((row: any) => {
      const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {}
      const planner = data.planner && typeof data.planner === 'object' ? (data.planner as Record<string, unknown>) : {}
      return String(planner.plan_id || '') === planId
    })

    if (linkedContent.length === 0) {
      return NextResponse.json({
        ok: true,
        updated: false,
        detail: 'No scheduled/generated content linked to this plan yet.',
      })
    }

    const contentIds = linkedContent.map((c: any) => c.id)
    const { data: perfRows } = await admin
      .from('performance_v2')
      .select('content_id, platform, views, engagement, revenue, recorded_at')
      .in('content_id', contentIds)
      .order('recorded_at', { ascending: false })

    const perfByContent = new Map<string, { score: number; platform: string }>()
    for (const row of perfRows ?? []) {
      const score =
        Number(row.engagement || 0) +
        Number(row.views || 0) * 0.02 +
        Number(row.revenue || 0) * 25
      const key = String(row.content_id)
      const existing = perfByContent.get(key)
      if (!existing || score > existing.score) {
        perfByContent.set(key, {
          score,
          platform: String(row.platform || 'instagram'),
        })
      }
    }

    const ranked = linkedContent
      .map((row: any) => {
        const data = row.data && typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {}
        const hook = String(data.hook || data.title || '')
        const cta = String(data.cta || '')
        const perf = perfByContent.get(String(row.id)) || { score: 0, platform: 'instagram' }
        return {
          contentId: String(row.id),
          hook,
          cta,
          platform: perf.platform,
          score: perf.score,
        }
      })
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)

    const top = ranked.slice(0, 5)
    const bottom = ranked.slice(-5)
    const preferredHooks = [...new Set(top.map((r: RankedItem) => r.hook).filter(Boolean))]
    const avoidHooks = [...new Set(bottom.map((r: RankedItem) => r.hook).filter(Boolean))]
    const preferredCtas = [...new Set(top.map((r: RankedItem) => r.cta).filter(Boolean))]

    const platformScores = new Map<string, number>()
    for (const row of top) {
      platformScores.set(row.platform, (platformScores.get(row.platform) || 0) + row.score)
    }
    const topPlatforms = [...platformScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([platform]) => platform)
      .slice(0, 3)

    const brandRules =
      strategyRow.brand_rules_json && typeof strategyRow.brand_rules_json === 'object'
        ? { ...(strategyRow.brand_rules_json as Record<string, unknown>) }
        : {}
    brandRules.prompt_intelligence = {
      generated_at: new Date().toISOString(),
      preferred_hooks: preferredHooks,
      avoid_hooks: avoidHooks,
      preferred_ctas: preferredCtas,
      top_platforms: topPlatforms,
      note: 'Auto-generated from recent performance to improve future prompts.',
    }

    const { error: updateError } = await admin
      .from('planner_strategy_profiles')
      .update({ brand_rules_json: brandRules })
      .eq('id', strategyRow.id)
      .eq('plan_id', planId)
    if (updateError) {
      return NextResponse.json({ detail: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      updated: true,
      analyzedContent: linkedContent.length,
      analyzedPerformanceRows: (perfRows ?? []).length,
      recommendations: {
        preferredHooks,
        avoidHooks,
        preferredCtas,
        topPlatforms,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to optimize plan strategy' },
      { status: 500 }
    )
  }
}

