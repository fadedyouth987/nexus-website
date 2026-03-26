import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { createClient } from '@/lib/supabase/server'
import { getOrgPlanSlug, getPrimaryOrgId } from '@/lib/api/org'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'checkpoint'

  const orgId = await getPrimaryOrgId(supabase, session.user.id)
  if (!orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 404 })
  }

  const planSlug = await getOrgPlanSlug(supabase, orgId)

  const { data: models, error } = await supabase
    .from('ai_models')
    .select('*')
    .eq('type', type)
    .order('usage_count', { ascending: false })

  if (error) {
    console.error('[api/models]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  const filtered = (models ?? []).filter((m) => {
    if (m.is_public) {
      return true
    }
    const allowed: string[] = Array.isArray(m.allowed_plans) ? m.allowed_plans : []
    return allowed.map((s) => String(s).toLowerCase()).includes(planSlug.toLowerCase())
  })

  return NextResponse.json({ models: filtered })
}
