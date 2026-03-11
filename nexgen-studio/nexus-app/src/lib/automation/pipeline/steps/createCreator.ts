import type { InfluencerPipelineContext, PipelineStep } from '@/lib/automation/pipeline/types'
import { getCreatorService } from '@/lib/automation/services/creator'

export function createCreatorStep(): PipelineStep<InfluencerPipelineContext> {
  return {
    name: 'create-creator',
    async execute(context) {
      const creatorService = getCreatorService(context.userId)
      const creator = await creatorService.create({
        persona: context.persona,
      })

      return {
        creator,
      }
    },
  }
}
