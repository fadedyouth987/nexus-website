import type { InfluencerPipelineContext, PipelineStep } from '@/lib/automation/pipeline/types'
import { getPlannerService } from '@/lib/automation/services/planner'

export function generateCalendarStep(durationDays: number = 30): PipelineStep<InfluencerPipelineContext> {
  return {
    name: 'generate-calendar',
    async execute(context) {
      if (!context.planId) {
        throw new Error('Plan ID is required before generating calendar')
      }

      const plannerService = getPlannerService()
      const contentItems = await plannerService.generateCalendar(context.planId, durationDays)

      return {
        contentItems,
      }
    },
  }
}
