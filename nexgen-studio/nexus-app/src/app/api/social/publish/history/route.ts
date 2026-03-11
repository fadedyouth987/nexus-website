import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export async function GET(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))

  try {
    const admin = getEngineSupabaseAdmin()
    const { data, error } = await admin
      .from('publish_jobs')
      .select('id, provider, post_content, status, scheduled_for, published_at, error_message, created_at')
      .eq('user_id', token.sub)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return NextResponse.json({ items: data || [] })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load history'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
