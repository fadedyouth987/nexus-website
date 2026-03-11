import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getAccountsForUser } from '@/lib/social/socialService'

export async function GET(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const accounts = await getAccountsForUser(token.sub)
    return NextResponse.json(
      accounts.map((a) => ({
        id: a.id,
        provider: a.provider,
        accountName: a.account_name,
        accountId: a.account_id,
        tokenExpiresAt: a.token_expires_at,
        scopes: a.scopes,
        createdAt: a.created_at,
      }))
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load accounts'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
