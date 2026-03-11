import type { ContentItemInput } from '@/lib/planner/types'
import { generateCalendar } from '@/lib/planner/actions'

export async function generatePlanCalendar(
  planId: string,
  durationDays: number = 30
): Promise<ContentItemInput[]> {
  return generateCalendar(planId, durationDays)
}
