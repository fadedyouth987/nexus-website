import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/service'

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(key)
}

export const PLAN_PRICES = {
  starter: { monthly: 'price_starter_monthly', yearly: 'price_starter_yearly' },
  professional: { monthly: 'price_professional_monthly', yearly: 'price_professional_yearly' },
  enterprise: { monthly: 'price_enterprise_monthly', yearly: 'price_enterprise_yearly' },
} as const

export async function createCustomer(email: string, orgId: string) {
  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email,
    metadata: { orgId },
  })
  return customer.id
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  const supabase = createServiceClient()

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
      if (!customerId) {
        break
      }
      const planUuid = subscription.items.data[0]?.price?.metadata?.plan_id
      await supabase
        .from('organizations')
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          ...(planUuid && /^[0-9a-f-]{36}$/i.test(planUuid) ? { plan_id: planUuid } : {}),
        })
        .eq('stripe_customer_id', customerId)
      break
    }
    default:
      break
  }
}
