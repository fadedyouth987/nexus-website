import { generateStrategy } from '@/lib/planner/actions'

export async function generatePlanStrategy(planId: string): Promise<Record<string, unknown>> {
  return generateStrategy(planId)
}
