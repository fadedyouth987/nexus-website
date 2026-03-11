import { NextResponse } from 'next/server'
import { verifyAndStoreWebhook } from '@/lib/social/webhookService'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'nexgen-verify'
  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { headers: { 'Content-Type': 'text/plain' } })
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('x-hub-signature-256') || ''
  const headers: Record<string, string> = {}
  request.headers.forEach((v, k) => { headers[k] = v })
  const result = await verifyAndStoreWebhook('instagram', rawBody, signature, headers)
  if (result.challenge) {
    return new NextResponse(result.challenge, { headers: { 'Content-Type': 'text/plain' } })
  }
  if (!result.verified) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  return NextResponse.json({ received: true })
}
