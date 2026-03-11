import { getBlueprintRedis } from '@/lib/blueprint/redis'

export const ENGINE_AUTOPILOT_QUEUE = 'engine:autopilot'
export const ENGINE_SERIES_QUEUE = 'engine:series'
export const ENGINE_MODEL_QUEUE = 'engine:model'

export const ENGINE_AUTOPILOT_JOB = 'engine.autopilot.generate'
export const ENGINE_SERIES_JOB = 'engine.series.generate'
export const ENGINE_MODEL_VALIDATION_JOB = 'engine.model.validate'
export const ENGINE_MODEL_CLASSIFIER_JOB = 'engine.model.classify'
export const ENGINE_MODEL_REVIEW_JOB = 'engine.model.review'

type EngineQueuePayload =
  | {
      kind: 'autopilot_item'
      planItemId: string
    }
  | {
      kind: 'series_episode'
      seriesEpisodeId: string
    }
  | {
      kind: 'model_validation'
      modelId: string
      reservedCredits?: number
    }
  | {
      kind: 'model_classifier'
      modelId: string
    }
  | {
      kind: 'model_human_review'
      modelId: string
    }

function loadQueue() {
  const req = eval('require') as NodeRequire
  return req('bullmq').Queue
}

export async function enqueueEngineJob(opts: {
  queueName: string
  jobName: string
  payload: EngineQueuePayload
}) {
  const connection = getBlueprintRedis()
  const Queue = loadQueue()
  const queue = new Queue(opts.queueName, { connection })

  try {
    const job = await queue.add(opts.jobName, opts.payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    })

    return String(job.id)
  } finally {
    await queue.close()
    await connection.quit()
  }
}
