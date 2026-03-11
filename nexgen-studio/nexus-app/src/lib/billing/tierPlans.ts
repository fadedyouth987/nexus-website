export type TierPlanId = 'tier1' | 'tier2' | 'tier3' | 'enterprise'
export type PlanTier = 'STARTER' | 'PRO' | 'VAULT' | 'ENTERPRISE'

export type TierPlan = {
  id: TierPlanId
  title: string
  monthlyPrice: number
  annualPrice: number
  monthlyTokens: number
  storageGb: number
  teamSeats: string
  planTier: PlanTier
}

export const TIER_PLANS: Record<TierPlanId, TierPlan> = {
  tier1: {
    id: 'tier1',
    title: 'Tier 1',
    monthlyPrice: 49,
    annualPrice: 490,
    monthlyTokens: 600,
    storageGb: 100,
    teamSeats: '1',
    planTier: 'STARTER',
  },
  tier2: {
    id: 'tier2',
    title: 'Tier 2',
    monthlyPrice: 129,
    annualPrice: 1290,
    monthlyTokens: 2000,
    storageGb: 400,
    teamSeats: '1-3',
    planTier: 'PRO',
  },
  tier3: {
    id: 'tier3',
    title: 'Tier 3',
    monthlyPrice: 399,
    annualPrice: 3990,
    monthlyTokens: 7000,
    storageGb: 1500,
    teamSeats: '3-15',
    planTier: 'VAULT',
  },
  enterprise: {
    id: 'enterprise',
    title: 'Enterprise',
    monthlyPrice: 999,
    annualPrice: 9990,
    monthlyTokens: 20000,
    storageGb: 5000,
    teamSeats: '15+',
    planTier: 'ENTERPRISE',
  },
}

export const LEGACY_PLAN_ALIAS: Record<string, TierPlanId> = {
  creator: 'tier1',
  pro: 'tier2',
  agency: 'tier3',
}

export function resolveTierPlanId(input: unknown): TierPlanId {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : ''
  if (value in TIER_PLANS) return value as TierPlanId
  if (value in LEGACY_PLAN_ALIAS) return LEGACY_PLAN_ALIAS[value]
  return 'tier2'
}

export function getTierPlan(input: unknown): TierPlan {
  return TIER_PLANS[resolveTierPlanId(input)]
}

