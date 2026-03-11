import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

/**
 * Returns inbox "accounts" (social accounts) for the current user.
 * Used by Inbox UI to list accounts that have conversations.
 */
export async function GET(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = getEngineSupabaseAdmin()
    const { data, error } = await admin
      .from('social_accounts')
      .select('id, provider, account_name')
      .eq('user_id', token.sub)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    const accounts = (data ?? []).map((row: { id: string; provider: string; account_name: string }) => ({
      id: row.id,
      name: `${row.account_name} (${row.provider})`,
      platform: row.provider,
      unread: 0,
    }))

    return NextResponse.json(accounts)
  } catch (e) {
    return NextResponse.json(
      { detail: e instanceof Error ? e.message : 'Failed to load accounts' },
      { status: 500 }
    )
  }
}
