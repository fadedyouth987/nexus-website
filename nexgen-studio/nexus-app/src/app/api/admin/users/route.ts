import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/adminGuard'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401
    return NextResponse.json({ detail: (e as Error).message }, { status })
  }

  try {
    const admin = getEngineSupabaseAdmin()
    const { data, error } = await admin
      .from('blueprint_users')
      .select('id, plan, plan_status, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    const list = (data ?? []).map((row: { id: string; plan: string; plan_status: string; created_at: string }) => ({
      id: row.id,
      email: row.id.slice(0, 8) + '…',
      plan: row.plan ?? 'STARTER',
      status: row.plan_status ?? 'active',
      created_at: row.created_at,
    }))

    return NextResponse.json(list)
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Failed to load users' },
      { status: 500 }
    )
  }
}
