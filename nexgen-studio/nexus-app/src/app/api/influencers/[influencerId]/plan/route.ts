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

export async function POST(request: Request, context: { params: Promise<{ influencerId: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { influencerId } = await context.params
  const supabase = await createClient()
  const { data: influencer } = await supabase
    .from('influencers')
    .select('org_id')
    .eq('id', influencerId)
    .maybeSingle()

  if (!influencer) {
    return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', influencer.org_id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
  }

  const theme = typeof body.theme === 'string' ? body.theme.trim() : ''
  const date = typeof body.date === 'string' ? body.date : ''

  if (!theme || !date) {
    return NextResponse.json({ detail: 'theme and date are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('content_plans')
    .insert({
      influencer_id: influencerId,
      org_id: influencer.org_id,
      theme,
      notes: typeof body.notes === 'string' ? body.notes.trim() : '',
      date,
    })
    .select('*')
    .single()

  if (error) {
    return NextResponse.json({ detail: 'Failed to create content plan' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
