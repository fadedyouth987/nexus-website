import {
  ENGINE_AUTOPILOT_JOB,
  ENGINE_AUTOPILOT_QUEUE,
  enqueueEngineJob,
} from '@/lib/engine/queue'

export const AUTOPILOT_PLAN_ITEM_QUEUE = ENGINE_AUTOPILOT_QUEUE
export const AUTOPILOT_PLAN_ITEM_JOB = ENGINE_AUTOPILOT_JOB

export async function enqueueAutopilotPlanItem(opts: { planItemId: string }) {
  return enqueueEngineJob({
    queueName: ENGINE_AUTOPILOT_QUEUE,
    jobName: ENGINE_AUTOPILOT_JOB,
    payload: {
      kind: 'autopilot_item',
      planItemId: opts.planItemId,
    },
  })
}
