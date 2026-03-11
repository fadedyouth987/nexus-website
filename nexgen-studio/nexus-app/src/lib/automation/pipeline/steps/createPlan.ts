import type { InfluencerPipelineContext, PipelineStep } from '@/lib/automation/pipeline/types'
import { getPlannerService } from '@/lib/automation/services/planner'

export function createPlanStep(): PipelineStep<InfluencerPipelineContext> {
  return {
    name: 'create-plan',
    async execute(context) {
      const plannerService = getPlannerService()
      const { planId } = await plannerService.createPlan(context.userId, {
        name: `${String(context.persona.name || 'Untitled').trim()} - content plan`,
      })

      return {
        planId,
      }
    },
  }
}
