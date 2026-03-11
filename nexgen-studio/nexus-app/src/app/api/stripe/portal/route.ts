import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import Stripe from 'stripe'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

const stripeSecret = process.env.STRIPE_SECRET_KEY || ''
const stripe = stripeSecret ? new Stripe(stripeSecret) : null
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ detail: 'Stripe is not configured' }, { status: 500 })
  }

  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }
  const userId = token.sub

  let body: { returnUrl?: string }
  try {
    body = await request.json().catch(() => ({}))
  } catch {
    body = {}
  }

  const admin = getEngineSupabaseAdmin()
  const { data: profile, error: profileError } = await admin
    .from('blueprint_users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ detail: profileError.message || 'Failed to load billing profile' }, { status: 500 })
  }

  const customerId = typeof profile?.stripe_customer_id === 'string' ? profile.stripe_customer_id.trim() : ''
  if (!customerId || !customerId.startsWith('cus_')) {
    return NextResponse.json(
      { detail: 'No billing customer linked. Complete a checkout first, or link Stripe in organization settings.' },
      { status: 400 }
    )
  }

  const returnUrl = body.returnUrl || `${siteUrl}/settings/billing`

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create portal session'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
