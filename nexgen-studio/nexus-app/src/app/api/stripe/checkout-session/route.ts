import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import Stripe from 'stripe'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { getTierPlan, resolveTierPlanId } from '@/lib/billing/tierPlans'
import { getStripePriceId } from '@/lib/billing/stripePrices'

const stripeSecret = process.env.STRIPE_SECRET_KEY || ''
const stripe = stripeSecret ? new Stripe(stripeSecret) : null
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

type AddOns = {
  extraInfluencers: number
  extraTokens: number
  nsfwAddOn: boolean
  extraTeamSeats: number
}

type CheckoutBody = {
  planId?: string
  interval?: 'monthly' | 'yearly'
  addOns?: Partial<AddOns> & { extraCredits?: number }
  successUrl?: string
  cancelUrl?: string
}

function parseBody(input: unknown): CheckoutBody {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {}
  }
  return input as CheckoutBody
}

function toInt(input: unknown, max: number) {
  const value = Number(input)
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(max, Math.floor(value)))
}

function normalizeAddOns(input: CheckoutBody['addOns']): AddOns {
  const rawExtraTokens =
    typeof input?.extraCredits === 'number' || typeof input?.extraCredits === 'string'
      ? input?.extraCredits
      : input?.extraTokens
  return {
    extraInfluencers: toInt(input?.extraInfluencers, 100),
    extraTokens: toInt(rawExtraTokens, 50000),
    nsfwAddOn: Boolean(input?.nsfwAddOn),
    extraTeamSeats: toInt(input?.extraTeamSeats, 500),
  }
}

function safeUrl(input: unknown, fallback: string) {
  if (typeof input !== 'string' || !input.trim()) {
    return fallback
  }
  const value = input.trim()
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }
  if (value.startsWith('/')) {
    return `${siteUrl}${value}`
  }
  return fallback
}

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
  const email = typeof token.email === 'string' ? token.email : undefined

  let parsedBody: CheckoutBody = {}
  try {
    parsedBody = parseBody(await request.json())
  } catch {
    parsedBody = {}
  }

  const planId = resolveTierPlanId(parsedBody.planId)
  const plan = getTierPlan(planId)
  const interval = parsedBody.interval === 'yearly' ? 'yearly' : 'monthly'
  const addOns = normalizeAddOns(parsedBody.addOns)

  const addOnTotalMonthly =
    addOns.extraInfluencers * 15 +
    Math.round(addOns.extraTokens / 100) * 5 +
    (addOns.nsfwAddOn ? 19 : 0) +
    addOns.extraTeamSeats * 29
  const monthlyTokens = plan.monthlyTokens + addOns.extraTokens + addOns.extraInfluencers * 200
  const tokensPerCycle = interval === 'yearly' ? monthlyTokens * 12 : monthlyTokens
  const baseAmount = interval === 'yearly' ? plan.annualPrice : plan.monthlyPrice
  const billingAmount = baseAmount + addOnTotalMonthly * (interval === 'yearly' ? 10 : 1)
  const amountCents = Math.round(billingAmount * 100)
  const useStripePriceId =
    addOnTotalMonthly === 0 && addOns.extraInfluencers === 0 && addOns.extraTokens === 0 && !addOns.nsfwAddOn && addOns.extraTeamSeats === 0
  const stripePriceId = useStripePriceId ? getStripePriceId(planId, interval) : null

  const successUrl = safeUrl(parsedBody.successUrl, `${siteUrl}/settings/billing?success=1`)
  const cancelUrl = safeUrl(parsedBody.cancelUrl, `${siteUrl}/checkout`)

  try {
    const admin = getEngineSupabaseAdmin()
    const { data: profile } = await admin
      .from('blueprint_users')
      .select('stripe_customer_id, stripe_subscription_id, plan_status')
      .eq('id', userId)
      .maybeSingle()

    const hasActiveSubscription =
      typeof profile?.stripe_subscription_id === 'string' &&
      !!profile.stripe_subscription_id &&
      profile.plan_status !== 'CANCELED'

    if (hasActiveSubscription) {
      return NextResponse.json(
        { detail: 'An active subscription already exists. Open billing portal to manage your plan.' },
        { status: 409 }
      )
    }

    const metadata = {
      userId,
      planId,
      planTier: plan.planTier,
      interval,
      monthlyTokens: String(Math.floor(monthlyTokens)),
      tokensPerCycle: String(Math.floor(tokensPerCycle)),
      addOns: JSON.stringify(addOns),
    }

    const lineItems: Stripe.Checkout.SessionCreateParams['line_items'] = stripePriceId
      ? [{ price: stripePriceId, quantity: 1 }]
      : [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: amountCents,
              recurring: {
                interval: interval === 'yearly' ? 'year' : 'month',
              },
              product_data: {
                name: `${plan.title} subscription`,
                description:
                  interval === 'yearly'
                    ? `${monthlyTokens} tokens/month equivalent, billed annually.`
                    : `${monthlyTokens} tokens/month, billed monthly.`,
              },
            },
          },
        ]

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      client_reference_id: userId,
      customer: profile?.stripe_customer_id || undefined,
      customer_email: profile?.stripe_customer_id ? undefined : email,
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      line_items: lineItems,
      metadata,
      subscription_data: {
        metadata,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create checkout session'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
