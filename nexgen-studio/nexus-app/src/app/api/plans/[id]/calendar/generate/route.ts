import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { generateCalendar } from '@/lib/planner/actions'

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

    let body: { durationDays?: number } = {}
    try {
      body = await request.json().catch(() => ({}))
    } catch {
      // optional body
    }
    const durationDays = typeof body.durationDays === 'number' && body.durationDays > 0 && body.durationDays <= 365
      ? body.durationDays
      : 30

    const items = await generateCalendar(planId, durationDays)
    return NextResponse.json({ items, count: items.length })
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Failed to generate calendar' },
      { status: 500 }
    )
  }
}
