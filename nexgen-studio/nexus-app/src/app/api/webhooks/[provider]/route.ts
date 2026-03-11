import { NextResponse } from 'next/server'
import { verifyAndStoreWebhook } from '@/lib/social/webhookService'
import { VALID_PROVIDERS } from '@/lib/social/providers'
import type { SocialProviderId } from '@/lib/social/providerInterface'

const PROVIDERS_WITH_VERIFY: SocialProviderId[] = ['instagram', 'facebook']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const provider = (await params).provider?.toLowerCase() as SocialProviderId
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }
  if (PROVIDERS_WITH_VERIFY.includes(provider)) {
    const { searchParams } = new URL(request.url)
    const challenge = searchParams.get('hub.challenge') || searchParams.get('challenge')
    const token = searchParams.get('hub.verify_token') || searchParams.get('verify_token')
    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || process.env[`${provider.toUpperCase()}_WEBHOOK_VERIFY_TOKEN`] || 'nexgen-verify'
    if (token === verifyToken && challenge) {
      return new NextResponse(challenge, { headers: { 'Content-Type': 'text/plain' } })
    }
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const provider = (await params).provider?.toLowerCase() as SocialProviderId
  if (!provider || !VALID_PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 })
  }
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256') || request.headers.get('x-signature') || request.headers.get('x-twitter-signature') || ''
  const headers: Record<string, string> = {}
  request.headers.forEach((v, k) => { headers[k] = v })
  const result = await verifyAndStoreWebhook(provider, rawBody, signature, headers)
  if (result.challenge) {
    return new NextResponse(result.challenge, { headers: { 'Content-Type': 'text/plain' } })
  }
  if (!result.verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  return NextResponse.json({ received: true })
}
