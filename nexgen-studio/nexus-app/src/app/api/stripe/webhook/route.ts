import { NextResponse } from 'next/server'
import { getStripe, handleStripeWebhookEvent } from '@/lib/billing/stripe'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const rawBody = await request.text()

  try {
    const stripe = getStripe()
    const event = stripe.webhooks.constructEvent(rawBody, signature, secret)
    await handleStripeWebhookEvent(event)
    return NextResponse.json({ received: true })
  } catch (e) {
    console.error('[stripe webhook]', e)
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }
}
