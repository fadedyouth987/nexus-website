import type { TierPlanId } from '@/lib/billing/tierPlans'

type BillingInterval = 'monthly' | 'yearly'

const STRIPE_PRICE_ENV_MAP: Record<TierPlanId, Record<BillingInterval, string | undefined>> = {
  tier1: {
    monthly: process.env.STRIPE_PRICE_TIER1_MONTHLY,
    yearly: process.env.STRIPE_PRICE_TIER1_YEARLY,
  },
  tier2: {
    monthly: process.env.STRIPE_PRICE_TIER2_MONTHLY,
    yearly: process.env.STRIPE_PRICE_TIER2_YEARLY,
  },
  tier3: {
    monthly: process.env.STRIPE_PRICE_TIER3_MONTHLY,
    yearly: process.env.STRIPE_PRICE_TIER3_YEARLY,
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY,
    yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY,
  },
}

export function getStripePriceId(planId: TierPlanId, interval: BillingInterval): string | null {
  const priceId = STRIPE_PRICE_ENV_MAP[planId][interval]
  return typeof priceId === 'string' && priceId.trim() ? priceId.trim() : null
}
