import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

/**
 * Send a message in a thread and persist it in inbox tables.
 */
export async function POST(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as {
    accountId?: string
    threadId?: string
    content?: string
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ detail: 'content required' }, { status: 400 })
  }

  try {
    const admin = getEngineSupabaseAdmin()
    const { data: account } = await admin
      .from('social_accounts')
      .select('id, user_id')
      .eq('id', body.accountId ?? '')
      .eq('user_id', token.sub)
      .maybeSingle()

    if (!account) {
      return NextResponse.json({ detail: 'Account not found' }, { status: 404 })
    }

    const content = body.content.trim()
    let threadId = body.threadId?.trim() || ''

    if (threadId) {
      const { data: existingThread } = await admin
        .from('inbox_threads')
        .select('id')
        .eq('id', threadId)
        .eq('user_id', token.sub)
        .eq('social_account_id', body.accountId ?? '')
        .maybeSingle()
      if (!existingThread) {
        return NextResponse.json({ detail: 'Thread not found' }, { status: 404 })
      }
    } else {
      const { data: createdThread, error: createThreadError } = await admin
        .from('inbox_threads')
        .insert({
          user_id: token.sub,
          social_account_id: body.accountId ?? '',
          title: 'New conversation',
          unread_count: 0,
          last_message_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (createThreadError || !createdThread?.id) {
        if (createThreadError?.message?.includes('relation') && createThreadError.message.includes('does not exist')) {
          return NextResponse.json(
            { detail: 'Inbox persistence not yet migrated. Apply latest database migrations.' },
            { status: 503 }
          )
        }
        return NextResponse.json(
          { detail: createThreadError?.message || 'Failed to create thread' },
          { status: 500 }
        )
      }
      threadId = String(createdThread.id)
    }

    const { error: messageError } = await admin.from('inbox_messages').insert({
      thread_id: threadId,
      user_id: token.sub,
      direction: 'outgoing',
      sender_name: 'You',
      content,
    })

    if (messageError) {
      return NextResponse.json({ detail: messageError.message }, { status: 500 })
    }

    const { error: threadUpdateError } = await admin
      .from('inbox_threads')
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq('id', threadId)
      .eq('user_id', token.sub)

    if (threadUpdateError) {
      return NextResponse.json({ detail: threadUpdateError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      threadId,
      message: 'Message saved in inbox. Provider delivery wiring can run asynchronously.',
    })
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Failed to send' },
      { status: 500 }
    )
  }
}
