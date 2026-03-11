import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

const stripeSecret = process.env.STRIPE_SECRET_KEY || ''
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''
const stripe = stripeSecret ? new Stripe(stripeSecret) : null

type PlanTier = 'STARTER' | 'PRO' | 'VAULT' | 'ENTERPRISE'
type PlanStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizeUserId(raw: string | null | undefined) {
  const value = (raw || '').trim()
  return UUID_PATTERN.test(value) ? value : ''
}

function parsePositiveInt(value: string | null | undefined) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.max(0, Math.floor(num))
}

/** Returns undefined for missing/invalid so fallback with ?? preserves 0. */
function parseOptionalPositiveInt(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const num = Number(value)
  if (!Number.isFinite(num)) return undefined
  return Math.max(0, Math.floor(num))
}

function toIsoDateFromUnix(seconds: number | null | undefined) {
  if (!seconds || !Number.isFinite(seconds)) {
    return null
  }
  return new Date(seconds * 1000).toISOString()
}

function subscriptionRenewsAt(subscription: Stripe.Subscription | null | undefined) {
  const periodEnd = subscription?.items?.data?.[0]?.current_period_end
  return toIsoDateFromUnix(periodEnd)
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  if (typeof subscriptionRef === 'string') {
    return subscriptionRef
  }
  if (subscriptionRef && typeof subscriptionRef === 'object' && 'id' in subscriptionRef) {
    const id = subscriptionRef.id
    return typeof id === 'string' ? id : null
  }
  return null
}

function normalizePlanTier(raw: string | null | undefined): PlanTier | null {
  if (!raw) return null
  const value = raw.trim().toUpperCase()
  if (value === 'STARTER' || value === 'CREATOR') return 'STARTER'
  if (value === 'PRO') return 'PRO'
  if (value === 'VAULT') return 'VAULT'
  if (value === 'ENTERPRISE' || value === 'AGENCY' || value === 'SCALE') return 'ENTERPRISE'
  return null
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status): PlanStatus {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ACTIVE'
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
    case 'incomplete_expired':
      return 'PAST_DUE'
    case 'canceled':
    case 'paused':
      return 'CANCELED'
    default:
      return 'PAST_DUE'
  }
}

async function findUserIdByCustomerId(admin: any, customerId: string) {
  const { data, error } = await admin
    .from('blueprint_users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .limit(1)

  if (error) {
    throw new Error(error.message || 'Failed to resolve Stripe customer')
  }

  const candidate = Array.isArray(data) && data[0]?.id ? String(data[0].id) : ''
  return normalizeUserId(candidate) || null
}

async function upsertBillingProfile(
  admin: any,
  input: {
    userId: string
    customerId?: string | null
    subscriptionId?: string | null
    planTier?: PlanTier | null
    planStatus?: PlanStatus | null
    renewsAt?: string | null
  }
) {
  if (!normalizeUserId(input.userId)) {
    return
  }

  const row: Record<string, string | null> = { id: input.userId }

  if (input.customerId !== undefined) {
    row.stripe_customer_id = input.customerId
  }
  if (input.subscriptionId !== undefined) {
    row.stripe_subscription_id = input.subscriptionId
  }
  if (input.planTier) {
    row.plan = input.planTier
  }
  if (input.planStatus) {
    row.plan_status = input.planStatus
  }
  if (input.renewsAt !== undefined) {
    row.plan_renews_at = input.renewsAt
  }

  const { error } = await admin.from('blueprint_users').upsert(row, {
    onConflict: 'id',
    ignoreDuplicates: false,
  })
  if (error) {
    throw new Error(error.message || 'Failed to update billing profile')
  }
}

async function creditAlreadyApplied(admin: any, userId: string, refType: string, refId: string) {
  const { data, error } = await admin
    .from('credit_ledger')
    .select('id')
    .eq('user_id', userId)
    .eq('ref_type', refType)
    .eq('ref_id', refId)
    .limit(1)

  if (error) {
    throw new Error(error.message || 'Failed to check existing credit ledger entry')
  }

  return Array.isArray(data) && data.length > 0
}

async function applyCredits(admin: any, userId: string, credits: number, refType: string, refId: string) {
  if (!Number.isFinite(credits) || credits <= 0) return

  const alreadyApplied = await creditAlreadyApplied(admin, userId, refType, refId)
  if (alreadyApplied) return

  const { error } = await admin.from('credit_ledger').insert({
    user_id: userId,
    delta: Math.floor(credits),
    reason: 'BILLING_TOPUP',
    ref_type: refType,
    ref_id: refId,
  })
  if (error) {
    throw new Error(error.message || 'Failed to apply credit topup')
  }
}

async function retrieveSubscription(subscriptionId: string) {
  if (!stripe) return null
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    return subscription as unknown as Stripe.Subscription
  } catch {
    return null
  }
}

async function handleCheckoutSessionCompleted(admin: any, session: Stripe.Checkout.Session) {
  const metadata = session.metadata || {}
  const userId = normalizeUserId(metadata.userId || session.client_reference_id || '')
  if (!userId) return

  const customerId = typeof session.customer === 'string' ? session.customer : null
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null
  let planTier = normalizePlanTier(metadata.planTier || metadata.planId || null)
  let planStatus: PlanStatus = 'ACTIVE'
  let renewsAt: string | null = null

  if (subscriptionId && stripe) {
    const subscription = await retrieveSubscription(subscriptionId)
    if (!subscription) return
    planTier =
      normalizePlanTier(subscription.metadata?.planTier || subscription.metadata?.planId || null) || planTier
    planStatus = mapSubscriptionStatus(subscription.status)
    renewsAt = subscriptionRenewsAt(subscription)
  }

  await upsertBillingProfile(admin, {
    userId,
    customerId,
    subscriptionId,
    planTier,
    planStatus,
    renewsAt,
  })
}

async function handleSubscriptionUpdated(admin: any, subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : null
  let userId = normalizeUserId(subscription.metadata?.userId || '')
  if (!userId && customerId) {
    userId = (await findUserIdByCustomerId(admin, customerId)) || ''
  }
  if (!userId) return

  const planTier = normalizePlanTier(subscription.metadata?.planTier || subscription.metadata?.planId || null)
  const planStatus = mapSubscriptionStatus(subscription.status)
  const renewsAt = subscriptionRenewsAt(subscription)

  await upsertBillingProfile(admin, {
    userId,
    customerId,
    subscriptionId: subscription.id,
    planTier,
    planStatus,
    renewsAt,
  })
}

async function handleInvoicePaymentSucceeded(admin: any, invoice: Stripe.Invoice) {
  const invoiceId = invoice.id
  if (!invoiceId) return

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : null
  const subscriptionId = invoiceSubscriptionId(invoice)
  if (!subscriptionId) return

  const subscription = await retrieveSubscription(subscriptionId)
  const invoiceSubscriptionMetadata = invoice.parent?.subscription_details?.metadata || null

  let userId = normalizeUserId(subscription?.metadata?.userId || '')
  if (!userId && customerId) {
    userId = (await findUserIdByCustomerId(admin, customerId)) || ''
  }
  if (!userId) return

  const billingUnitsPerCycle =
    parseOptionalPositiveInt(subscription?.metadata?.tokensPerCycle) ??
    parseOptionalPositiveInt(subscription?.metadata?.creditsPerCycle) ??
    parseOptionalPositiveInt(invoiceSubscriptionMetadata?.tokensPerCycle) ??
    parseOptionalPositiveInt(invoiceSubscriptionMetadata?.creditsPerCycle) ??
    parseOptionalPositiveInt(invoice.metadata?.tokensPerCycle) ??
    parseOptionalPositiveInt(invoice.metadata?.creditsPerCycle) ??
    parseOptionalPositiveInt(invoice.metadata?.tokens) ??
    parseOptionalPositiveInt(invoice.metadata?.credits) ??
    0

  await applyCredits(admin, userId, billingUnitsPerCycle, 'STRIPE_INVOICE', invoiceId)

  await upsertBillingProfile(admin, {
    userId,
    customerId,
    subscriptionId,
    planTier: normalizePlanTier(
      subscription?.metadata?.planTier ||
        subscription?.metadata?.planId ||
        invoiceSubscriptionMetadata?.planTier ||
        invoiceSubscriptionMetadata?.planId ||
        null
    ),
    planStatus: subscription ? mapSubscriptionStatus(subscription.status) : 'ACTIVE',
    renewsAt: subscription ? subscriptionRenewsAt(subscription) : null,
  })
}

async function handleInvoicePaymentFailed(admin: any, invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : null
  const subscriptionId = invoiceSubscriptionId(invoice)

  let userId = ''
  if (subscriptionId && stripe) {
    const subscription = await retrieveSubscription(subscriptionId)
    if (!subscription) return
    userId = normalizeUserId(subscription.metadata?.userId || '')
    if (!userId && customerId) {
      userId = (await findUserIdByCustomerId(admin, customerId)) || ''
    }
    if (!userId) return
    await upsertBillingProfile(admin, {
      userId,
      customerId,
      subscriptionId,
      planTier: normalizePlanTier(subscription.metadata?.planTier || subscription.metadata?.planId || null),
      planStatus: mapSubscriptionStatus(subscription.status),
      renewsAt: subscriptionRenewsAt(subscription),
    })
    return
  }

  if (!customerId) return
  userId = (await findUserIdByCustomerId(admin, customerId)) || ''
  if (!userId) return

  await upsertBillingProfile(admin, {
    userId,
    customerId,
    subscriptionId,
    planStatus: 'PAST_DUE',
  })
}

export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ detail: 'Stripe webhook is not configured' }, { status: 500 })
  }

  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ detail: 'Missing stripe-signature header' }, { status: 400 })
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Invalid webhook signature' },
      { status: 400 }
    )
  }

  const admin = getEngineSupabaseAdmin()

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(admin, event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpdated(admin, event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(admin, event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(admin, event.data.object as Stripe.Invoice)
        break
      default:
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to process Stripe webhook'
    return NextResponse.json({ detail: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
