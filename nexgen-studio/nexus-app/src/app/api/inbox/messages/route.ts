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
  const threadId = searchParams.get('threadId')
  if (!threadId) {
    return NextResponse.json({ detail: 'threadId required' }, { status: 400 })
  }

  try {
    const admin = getEngineSupabaseAdmin()
    const { data: thread } = await admin
      .from('inbox_threads')
      .select('id')
      .eq('id', threadId)
      .eq('user_id', token.sub)
      .maybeSingle()

    if (!thread) {
      return NextResponse.json({ detail: 'Thread not found' }, { status: 404 })
    }

    const { data, error } = await admin
      .from('inbox_messages')
      .select('id, direction, sender_name, content, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })

    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        return NextResponse.json([])
      }
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    return NextResponse.json(
      (data ?? []).map((row: any) => ({
        id: String(row.id),
        sender: row.direction === 'outgoing' ? 'You' : String(row.sender_name || 'Contact'),
        message: String(row.content || ''),
        time: row.created_at ? new Date(row.created_at).toLocaleString() : '',
        unread: row.direction === 'incoming',
      }))
    )
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load messages' },
      { status: 500 }
    )
  }
}

