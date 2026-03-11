import type { InfluencerPipelineContext, PipelineStep } from '@/lib/automation/pipeline/types'
import { getPlannerService } from '@/lib/automation/services/planner'

export function generateStrategyStep(): PipelineStep<InfluencerPipelineContext> {
  return {
    name: 'generate-strategy',
    async execute(context) {
      if (!context.planId) {
        throw new Error('Plan ID is required before generating strategy')
      }

      const plannerService = getPlannerService()
      const strategy = await plannerService.generateStrategy(context.planId)

      return {
        strategy,
      }
    },
  }
}
