import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { createClient } from '@/lib/supabase/server'

async function getUserId(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })
  return typeof token?.id === 'string' ? token.id : null
}

async function isMember(supabase: any, userId: string, orgId: string) {
  const { data } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()

  return Boolean(data)
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const supabase = await createClient()
  if (!(await isMember(supabase, userId, id))) {
    return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('influencers')
    .select('*')
    .eq('org_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ detail: 'Failed to load influencers' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const supabase = await createClient()
  if (!(await isMember(supabase, userId, id))) {
    return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const handle = typeof body.handle === 'string' ? body.handle.trim() : ''
  const niche = typeof body.niche === 'string' ? body.niche.trim() : ''

  if (!name || !handle || !niche) {
    return NextResponse.json({ detail: 'name, handle, and niche are required' }, { status: 400 })
  }

  const payload = {
    org_id: id,
    name,
    handle,
    bio: typeof body.bio === 'string' ? body.bio.trim() : '',
    niche,
    style_template: typeof body.style_template === 'string' ? body.style_template.trim() : '',
    lore: typeof body.lore === 'string' ? body.lore.trim() : '',
    persona_traits:
      body.persona_traits && typeof body.persona_traits === 'object' ? body.persona_traits : {},
    sfw_allowed: body.sfw_allowed !== false,
    nsfw_allowed: body.nsfw_allowed === true,
    ai_disclosure_required: body.ai_disclosure_required !== false,
  }

  const { data, error } = await supabase
    .from('influencers')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ detail: 'Failed to create influencer' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
