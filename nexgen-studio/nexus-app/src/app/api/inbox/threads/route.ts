import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

/**
 * Returns threads for an account. Verifies account ownership.
 * Thread list is empty until we have thread storage keyed by social account.
 */
export async function GET(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')
  if (!accountId) {
    return NextResponse.json({ detail: 'accountId required' }, { status: 400 })
  }

  try {
    const admin = getEngineSupabaseAdmin()
    const { data: account } = await admin
      .from('social_accounts')
      .select('id')
      .eq('id', accountId)
      .eq('user_id', token.sub)
      .maybeSingle()

    if (!account) {
      return NextResponse.json({ detail: 'Account not found' }, { status: 404 })
    }
    const { data: threads, error: threadsError } = await admin
      .from('inbox_threads')
      .select('id, title, last_message_at, unread_count')
      .eq('social_account_id', accountId)
      .eq('user_id', token.sub)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (threadsError) {
      if (threadsError.message.includes('relation') && threadsError.message.includes('does not exist')) {
        return NextResponse.json([])
      }
      return NextResponse.json({ detail: threadsError.message }, { status: 500 })
    }

    const threadIds = (threads ?? []).map((t: any) => t.id)
    let latestByThread = new Map<string, string>()

    if (threadIds.length > 0) {
      const { data: latest } = await admin
        .from('inbox_messages')
        .select('thread_id, content, created_at')
        .in('thread_id', threadIds)
        .order('created_at', { ascending: false })

      for (const row of latest ?? []) {
        const threadId = String((row as any).thread_id)
        if (!latestByThread.has(threadId)) {
          latestByThread.set(threadId, String((row as any).content || ''))
        }
      }
    }

    return NextResponse.json(
      (threads ?? []).map((thread: any) => ({
        id: thread.id,
        title: thread.title || 'Conversation',
        unread: Number(thread.unread_count || 0),
        lastMessageAt: thread.last_message_at,
        lastMessage: latestByThread.get(String(thread.id)) || '',
      }))
    )
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Failed to load threads' },
      { status: 500 }
    )
  }
}
