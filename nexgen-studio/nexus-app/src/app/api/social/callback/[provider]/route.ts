import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { handleCallback } from '@/lib/social/oauthService'
import { VALID_PROVIDERS } from '@/lib/social/providers'
import type { SocialProviderId } from '@/lib/social/providerInterface'

const FRONTEND_DASHBOARD = '/dashboard/social'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  const { provider: providerParam } = await params
  const providerId = providerParam?.toLowerCase() as SocialProviderId
  if (!providerId || !VALID_PROVIDERS.includes(providerId)) {
    return NextResponse.redirect(new URL(`${FRONTEND_DASHBOARD}?error=invalid_provider`, request.url))
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  if (error) {
    return NextResponse.redirect(new URL(`${FRONTEND_DASHBOARD}?error=${encodeURIComponent(error)}`, request.url))
  }
  if (!code) {
    return NextResponse.redirect(new URL(`${FRONTEND_DASHBOARD}?error=missing_code`, request.url))
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || request.url.split('/api')[0]
  const redirectUri = `${baseUrl}/api/social/callback/${providerId}`

  try {
    const accountName = state?.split('_').slice(0, -2).join('_') || `${providerId} account`
    await handleCallback(providerId, code, redirectUri, token.sub, accountName)
    return NextResponse.redirect(new URL(`${FRONTEND_DASHBOARD}?connected=${providerId}`, request.url))
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Callback failed'
    return NextResponse.redirect(new URL(`${FRONTEND_DASHBOARD}?error=${encodeURIComponent(message)}`, request.url))
  }
}
