import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { regenerateContentRange } from '@/lib/planner/actions'

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

    let body: { fromDay?: number; toDay?: number; instruction?: string } = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 })
    }

    const fromDay = typeof body.fromDay === 'number' ? body.fromDay : parseInt(String(body.fromDay), 10)
    const toDay = typeof body.toDay === 'number' ? body.toDay : parseInt(String(body.toDay), 10)
    const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : ''

    if (!Number.isFinite(fromDay) || !Number.isFinite(toDay) || fromDay < 1 || toDay > 365 || fromDay > toDay) {
      return NextResponse.json({ detail: 'Invalid fromDay or toDay' }, { status: 400 })
    }
    if (!instruction) {
      return NextResponse.json({ detail: 'instruction is required' }, { status: 400 })
    }

    const { updated, changeSummary } = await regenerateContentRange(planId, fromDay, toDay, instruction)
    return NextResponse.json({ updated, changeSummary })
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Failed to regenerate range' },
      { status: 500 }
    )
  }
}
