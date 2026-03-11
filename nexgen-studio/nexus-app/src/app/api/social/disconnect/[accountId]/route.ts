import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { disconnectAccount } from '@/lib/social/socialService'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { accountId } = await params
  if (!accountId) {
    return NextResponse.json({ detail: 'accountId required' }, { status: 400 })
  }

  try {
    await disconnectAccount(accountId, token.sub)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Disconnect failed'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
