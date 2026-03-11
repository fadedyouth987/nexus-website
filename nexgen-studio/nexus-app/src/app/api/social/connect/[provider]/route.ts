import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { buildConnectUrl } from '@/lib/social/oauthService'
import { VALID_PROVIDERS } from '@/lib/social/providers'
import type { SocialProviderId } from '@/lib/social/providerInterface'

async function handleConnect(
  request: Request,
  params: Promise<{ provider: string }>
) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { provider: providerParam } = await params
  const providerId = providerParam?.toLowerCase() as SocialProviderId
  if (!providerId || !VALID_PROVIDERS.includes(providerId)) {
    return NextResponse.json({ detail: 'Invalid provider' }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const redirectUri = searchParams.get('redirect_uri') || `${process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL}/api/social/callback/${providerId}`
  const state = `nexgen_${token.sub}_${providerId}_${Date.now()}_${Math.random().toString(36).slice(2)}`

  try {
    const { authUrl } = buildConnectUrl(providerId, redirectUri, state)
    return NextResponse.redirect(authUrl)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'OAuth config failed'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ provider: string }> }
) {
  return handleConnect(request, ctx.params)
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ provider: string }> }
) {
  return handleConnect(request, ctx.params)
}
