import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { getPrimaryOrgId } from '@/lib/api/org'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rule = RATE_LIMITS['/api/workflows']
  const rl = await checkRateLimit(`workflows:${session.user.id}`, rule)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, { status: 429 })
  }

  const supabase = await createClient()
  const orgId = await getPrimaryOrgId(supabase, session.user.id)

  const { data: publicRows, error: pubError } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('is_public', true)
    .order('is_featured', { ascending: false })
    .order('usage_count', { ascending: false })

  if (pubError) {
    console.error('[api/workflows]', pubError)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  let orgRows: typeof publicRows = []
  if (orgId) {
    const { data: mine, error: mineError } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('org_id', orgId)
      .order('is_featured', { ascending: false })
      .order('usage_count', { ascending: false })

    if (!mineError && mine) {
      orgRows = mine
    }
  }

  const byId = new Map<string, (typeof publicRows)[0]>()
  for (const r of [...(publicRows ?? []), ...orgRows]) {
    byId.set(r.id, r)
  }
  const templates = [...byId.values()].sort((a, b) => {
    if (a.is_featured !== b.is_featured) {
      return a.is_featured ? -1 : 1
    }
    return (b.usage_count ?? 0) - (a.usage_count ?? 0)
  })

  return NextResponse.json({ templates })
}
