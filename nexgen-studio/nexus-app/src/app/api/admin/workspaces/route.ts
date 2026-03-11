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
    const { data: orgs, error } = await admin
      .from('organizations')
      .select('id, name, created_at')
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    const list = (orgs ?? []).map((row: { id: string; name: string; created_at: string }) => ({
      id: row.id,
      name: row.name ?? row.id,
      owner: '',
      plan: 'CREATOR',
      nsfw_enabled: false,
      created_at: row.created_at,
    }))

    return NextResponse.json(list)
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Failed to load workspaces' },
      { status: 500 }
    )
  }
}
