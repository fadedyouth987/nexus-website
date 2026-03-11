import { NextResponse } from 'next/server'
import { getEngineUser } from '@/lib/engine/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export async function GET(
  request: Request,
  context: { params: Promise<{ planId: string }> }
) {
  try {
    const { authUserId } = await getEngineUser(request)
    const admin = getEngineSupabaseAdmin()
    const { planId } = await context.params

    const { data: plan } = await admin
      .from('autopilot_plans')
      .select('id, status, total_days, created_at, updated_at')
      .eq('id', planId)
      .eq('user_id', authUserId)
      .maybeSingle()

    if (!plan) {
      return NextResponse.json({ detail: 'Plan not found' }, { status: 404 })
    }

    const { data: items, error: itemError } = await admin
      .from('autopilot_plan_items')
      .select('id, day_index, status, queue_job_id')
      .eq('plan_id', planId)
      .order('day_index', { ascending: true })

    if (itemError) {
      return NextResponse.json({ detail: 'Failed to load plan items' }, { status: 500 })
    }

    return NextResponse.json({
      plan,
      items: items ?? [],
    })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load plan' },
      { status }
    )
  }
}
