import type { InfluencerPipelineContext, PipelineStep } from '@/lib/automation/pipeline/types'
import { getSchedulerService } from '@/lib/automation/services/scheduler'

export function queueToSchedulerStep(): PipelineStep<InfluencerPipelineContext> {
  return {
    name: 'queue-scheduler',
    enabled(context) {
      return Boolean(
        context.planId &&
        context.creator?.mode === 'v2' &&
        context.creator.id &&
        context.creator.orgId &&
        context.creator.workspaceId
      )
    },
    async execute(context) {
      if (
        !context.planId ||
        !context.creator?.id ||
        !context.creator.orgId ||
        !context.creator.workspaceId
      ) {
        throw new Error('V2 creator context is required before queueing to scheduler')
      }

      const schedulerService = getSchedulerService()
      const schedulerQueue = await schedulerService.queuePlannerToScheduler({
        userId: context.userId,
        planId: context.planId,
        orgId: context.creator.orgId,
        workspaceId: context.creator.workspaceId,
        creatorId: context.creator.id,
      })

      return {
        schedulerQueue,
      }
    },
  }
}
