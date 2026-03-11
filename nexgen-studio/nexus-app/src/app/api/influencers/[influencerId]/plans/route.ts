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

export async function GET(request: Request, context: { params: Promise<{ influencerId: string }> }) {
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

  const { data, error } = await supabase
    .from('content_plans')
    .select('*')
    .eq('influencer_id', influencerId)
    .order('date', { ascending: false })

  if (error) {
    return NextResponse.json([])
  }

  return NextResponse.json(data ?? [])
}
