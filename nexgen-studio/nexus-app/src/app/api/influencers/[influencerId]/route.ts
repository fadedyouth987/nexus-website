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

async function getInfluencer(supabase: any, userId: string, influencerId: string) {
  const { data, error } = await supabase
    .from('influencers')
    .select('*')
    .eq('id', influencerId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', data.org_id)
    .maybeSingle()

  return member ? data : null
}

export async function GET(request: Request, context: { params: Promise<{ influencerId: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { influencerId } = await context.params
  const supabase = await createClient()
  const influencer = await getInfluencer(supabase, userId, influencerId)

  if (!influencer) {
    return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
  }

  return NextResponse.json(influencer)
}

export async function PATCH(request: Request, context: { params: Promise<{ influencerId: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { influencerId } = await context.params
  const supabase = await createClient()
  const influencer = await getInfluencer(supabase, userId, influencerId)

  if (!influencer) {
    return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  for (const key of [
    'name',
    'handle',
    'bio',
    'niche',
    'style_template',
    'lore',
  ]) {
    if (typeof body[key] === 'string') {
      updates[key] = (body[key] as string).trim()
    }
  }
  for (const key of ['sfw_allowed', 'nsfw_allowed', 'ai_disclosure_required']) {
    if (typeof body[key] === 'boolean') {
      updates[key] = body[key]
    }
  }
  // Identity lock: face consistency across generations
  if (typeof body.reference_image_url === 'string') {
    updates.reference_image_url = body.reference_image_url.trim() || null
  }
  if (typeof body.reference_image_storage_key === 'string') {
    updates.reference_image_storage_key = body.reference_image_storage_key.trim() || null
  }
  if (typeof body.lora_model_path === 'string') {
    updates.lora_model_path = body.lora_model_path.trim() || null
  }

  const { data, error } = await supabase
    .from('influencers')
    .update(updates)
    .eq('id', influencerId)
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ detail: 'Failed to update influencer' }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request, context: { params: Promise<{ influencerId: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { influencerId } = await context.params
  const supabase = await createClient()
  const influencer = await getInfluencer(supabase, userId, influencerId)

  if (!influencer) {
    return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('influencers')
    .delete()
    .eq('id', influencerId)

  if (error) {
    return NextResponse.json({ detail: 'Failed to delete influencer' }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
