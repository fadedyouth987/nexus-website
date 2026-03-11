import type { InfluencerPipelineContext, PipelineStep } from '@/lib/automation/pipeline/types'
import { getPlannerService } from '@/lib/automation/services/planner'

export function generateBriefStep(): PipelineStep<InfluencerPipelineContext> {
  return {
    name: 'generate-brief',
    async execute(context) {
      if (!context.planId) {
        throw new Error('Plan ID is required before generating a brief')
      }

      const plannerService = getPlannerService()
      const brief = plannerService.buildBriefFromPersona(context.persona)
      await plannerService.saveBrief(context.planId, brief)

      return {
        brief,
      }
    },
  }
}
