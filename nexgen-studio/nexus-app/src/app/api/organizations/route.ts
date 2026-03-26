import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { createClient } from '@/lib/supabase/server'

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48)
  return base || `org-${Date.now().toString(36)}`
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select(
      `role, is_active, organizations ( id, name, slug, plan_id, subscription_status, usage_this_month, token_balance )`
    )
    .eq('user_id', session.user.id)
    .eq('is_active', true)

  if (error) {
    console.error('[api/organizations GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  type OrgRow = {
    id: string
    name: string
    slug: string
    plan_id: string | null
    subscription_status: string | null
    usage_this_month: unknown
    token_balance: number | null
  }

  const organizations: OrgRow[] = []
  for (const row of data ?? []) {
    const r = row as { organizations?: OrgRow | OrgRow[] | null }
    const o = r.organizations
    const one = Array.isArray(o) ? o[0] : o
    if (one?.id) {
      organizations.push(one)
    }
  }

  return NextResponse.json({ organizations })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { name?: string }
  try {
    body = (await request.json()) as { name?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length < 2) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: starter, error: planErr } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('slug', 'starter')
    .maybeSingle()

  if (planErr || !starter?.id) {
    console.error('[api/organizations POST] starter plan', planErr)
    return NextResponse.json({ error: 'Plan configuration missing' }, { status: 500 })
  }

  const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 8)}`

  const { data: org, error: orgErr } = await supabase
    .from('organizations')
    .insert({
      name,
      slug,
      plan_id: starter.id,
      subscription_status: 'active',
    })
    .select('id, name, slug, plan_id, subscription_status, usage_this_month, token_balance')
    .single()

  if (orgErr || !org) {
    console.error('[api/organizations POST] insert org', orgErr)
    return NextResponse.json({ error: 'Could not create organization' }, { status: 500 })
  }

  const { error: memErr } = await supabase.from('organization_members').insert({
    org_id: org.id,
    user_id: session.user.id,
    role: 'owner',
    is_active: true,
  })

  if (memErr) {
    console.error('[api/organizations POST] member', memErr)
    await supabase.from('organizations').delete().eq('id', org.id)
    return NextResponse.json({ error: 'Could not add membership' }, { status: 500 })
  }

  return NextResponse.json({ organization: org }, { status: 201 })
}
