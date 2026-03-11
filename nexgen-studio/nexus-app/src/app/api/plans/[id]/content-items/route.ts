import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

const PLANS = 'planner_plans'
const CONTENT_ITEMS = 'planner_content_items'

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
    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const week = searchParams.get('week')

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

    let query = admin
      .from(CONTENT_ITEMS)
      .select('*')
      .eq('plan_id', planId)
      .order('day_number', { ascending: true })

    if (platform && platform.trim()) {
      query = query.eq('platform', platform.trim())
    }
    if (week) {
      const w = parseInt(week, 10)
      if (w >= 1 && w <= 4) {
        const minDay = (w - 1) * 7 + 1
        const maxDay = w * 7
        query = query.gte('day_number', minDay).lte('day_number', maxDay)
      }
    }

    const { data: items, error } = await query

    if (error) {
      return NextResponse.json({ detail: 'Failed to load content items' }, { status: 500 })
    }

    return NextResponse.json({ items: items ?? [] })
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Failed to load content items' },
      { status: 500 }
    )
  }
}
