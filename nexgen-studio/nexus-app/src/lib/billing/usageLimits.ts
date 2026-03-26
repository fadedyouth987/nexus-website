import { createServiceClient } from '@/lib/supabase/service'
import { MONTHLY_GENERATION_CAPS, normalizePlan } from '@/lib/billing/planLimits'

function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

export async function getMonthlyGenerationsCount(orgId: string): Promise<number> {
  const service = createServiceClient()
  const { data } = await service
    .from('monthly_usage')
    .select('generations_count')
    .eq('org_id', orgId)
    .eq('month_year', currentMonthKey())
    .maybeSingle()

  return typeof data?.generations_count === 'number' ? data.generations_count : 0
}

/**
 * Throws if the org has reached its plan monthly generation cap (best-effort; uses `monthly_usage`).
 */
export async function assertMonthlyGenerationsAllowed(orgId: string, planSlug: string): Promise<void> {
  const plan = normalizePlan(planSlug)
  const cap = MONTHLY_GENERATION_CAPS[plan] ?? MONTHLY_GENERATION_CAPS.STARTER
  if (cap >= 999_999) {
    return
  }
  const count = await getMonthlyGenerationsCount(orgId)
  if (count >= cap) {
    throw new Error(`Monthly generation limit reached (${cap} for current plan).`)
  }
}
