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

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const supabase = await createClient()
  const { data: member } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  let query = supabase.from('posts').select('*').eq('org_id', id)
  if (status) {
    query = query.eq('status', status)
  }
  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ detail: 'Failed to load posts' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
