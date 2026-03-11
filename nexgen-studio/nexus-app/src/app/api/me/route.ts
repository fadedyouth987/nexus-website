import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function GET(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })

  if (!token?.sub && !token?.id) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    id: token.id || token.sub,
    email: token.email || null,
    name: token.name || null,
    vault_mode: token.vault_mode || 'sfw',
  })
}
