import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

const PLANS = 'planner_plans'
const PLAN_VERSIONS = 'planner_plan_versions'

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

    const { data: plan } = await admin
      .from(PLANS)
      .select('id')
      .eq('id', planId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!plan) {
      return NextResponse.json({ detail: 'Plan not found' }, { status: 404 })
    }

    const { data: versions, error } = await admin
      .from(PLAN_VERSIONS)
      .select('*')
      .eq('plan_id', planId)
      .order('version_number', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ detail: 'Failed to load versions' }, { status: 500 })
    }

    return NextResponse.json({ versions: versions ?? [] })
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Failed to load versions' },
      { status: 500 }
    )
  }
}
