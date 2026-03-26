import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { getPrimaryOrgId } from '@/lib/api/org'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await checkRateLimit(`assets:list:${session.user.id}`, { requests: 120, windowSeconds: 60 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, { status: 429 })
  }

  const supabase = await createClient()
  const orgId = await getPrimaryOrgId(supabase, session.user.id)
  if (!orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
  const offset = (page - 1) * limit
  const sort = searchParams.get('sort') || 'newest'

  const query = supabase
    .from('generated_assets')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .eq('is_archived', false)
    .order('created_at', { ascending: sort !== 'newest' })
    .range(offset, offset + limit - 1)

  const { data: assets, error, count } = await query

  if (error) {
    console.error('[api/assets]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const total = count ?? 0
  return NextResponse.json({
    assets: assets ?? [],
    hasMore: offset + limit < total,
  })
}
