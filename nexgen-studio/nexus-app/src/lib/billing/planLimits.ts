const PLAN_ORDER = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'] as const

const OUTPUT_LIMITS: Record<string, number> = {
  STARTER: 2,
  PROFESSIONAL: 8,
  ENTERPRISE: 16,
}

export function normalizePlan(plan?: string | null): string {
  if (!plan || typeof plan !== 'string') {
    return 'STARTER'
  }
  const upper = plan.toUpperCase().replace(/-/g, '_')
  if (upper === 'PRO') {
    return 'PROFESSIONAL'
  }
  if (PLAN_ORDER.includes(upper as (typeof PLAN_ORDER)[number])) {
    return upper
  }
  return 'STARTER'
}

export function generationOutputLimitByPlan(plan: string): number {
  const key = normalizePlan(plan)
  return OUTPUT_LIMITS[key] ?? OUTPUT_LIMITS.STARTER
}

/** Soft caps for `monthly_usage.generations_count` (enforced in API, not DB). */
export const MONTHLY_GENERATION_CAPS: Record<string, number> = {
  STARTER: 100,
  PROFESSIONAL: 500,
  ENTERPRISE: 1_000_000,
}
