import { Worker } from 'bullmq'
import {
  ENGINE_AUTOPILOT_QUEUE,
  ENGINE_MODEL_QUEUE,
  ENGINE_SERIES_QUEUE,
} from '../../../src/lib/engine/queue'
import { getWorkerRedis } from '../core/redis'
import { processAutopilotItem } from '../processors/processAutopilotItem'
import { processSeriesEpisode } from '../processors/processSeriesEpisode'
import { processModelValidationJob } from '../jobs/modelValidationJob'
import { processModelClassifierJob } from '../jobs/modelClassifierJob'
import { toBullMqQueueName } from '../../../src/server/providers/queue/queueName'

function concurrency(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export function startEngineWorkers() {
  const modelWorker = new Worker(
    toBullMqQueueName(ENGINE_MODEL_QUEUE),
    async (job: any) => {
      const payload = job.data as { kind?: string; modelId?: string; reservedCredits?: number } | undefined
      if (!payload?.kind || typeof payload.modelId !== 'string') {
        throw new Error(`Unsupported payload for ${ENGINE_MODEL_QUEUE}`)
      }

      if (payload.kind === 'model_validation') {
        return processModelValidationJob(payload.modelId, {
          preReservedCredits:
            typeof payload.reservedCredits === 'number' && Number.isFinite(payload.reservedCredits)
              ? Math.max(1, Math.floor(payload.reservedCredits))
              : undefined,
        })
      }
      if (payload.kind === 'model_classifier') {
        return processModelClassifierJob(payload.modelId)
      }
      if (payload.kind === 'model_human_review') {
        console.warn(`[worker:${ENGINE_MODEL_QUEUE}] model ${payload.modelId} requires human review`)
        return { status: 'REVIEW_REQUIRED' as const, modelId: payload.modelId }
      }

      throw new Error(`Unsupported model queue kind: ${payload.kind}`)
    },
    {
      connection: getWorkerRedis(),
      concurrency: concurrency('CONC_ENGINE_MODELS', 1),
    }
  )

  const autopilotWorker = new Worker(
    toBullMqQueueName(ENGINE_AUTOPILOT_QUEUE),
    async (job: any) => {
      const payload = job.data as { kind?: string; planItemId?: string } | undefined
      if (payload?.kind !== 'autopilot_item' || typeof payload.planItemId !== 'string') {
        throw new Error(`Unsupported payload for ${ENGINE_AUTOPILOT_QUEUE}`)
      }
      return processAutopilotItem({
        kind: 'autopilot_item',
        planItemId: payload.planItemId,
      })
    },
    {
      connection: getWorkerRedis(),
      concurrency: concurrency('CONC_ENGINE_AUTOPILOT', 1),
    }
  )

  const seriesWorker = new Worker(
    toBullMqQueueName(ENGINE_SERIES_QUEUE),
    async (job: any) => {
      const payload = job.data as { kind?: string; seriesEpisodeId?: string } | undefined
      if (payload?.kind !== 'series_episode' || typeof payload.seriesEpisodeId !== 'string') {
        throw new Error(`Unsupported payload for ${ENGINE_SERIES_QUEUE}`)
      }
      return processSeriesEpisode({
        kind: 'series_episode',
        seriesEpisodeId: payload.seriesEpisodeId,
      })
    },
    {
      connection: getWorkerRedis(),
      concurrency: concurrency('CONC_ENGINE_SERIES', 1),
    }
  )

  autopilotWorker.on('error', (error: unknown) => {
    console.error(`[worker:${ENGINE_AUTOPILOT_QUEUE}]`, error)
  })
  seriesWorker.on('error', (error: unknown) => {
    console.error(`[worker:${ENGINE_SERIES_QUEUE}]`, error)
  })
  modelWorker.on('error', (error: unknown) => {
    console.error(`[worker:${ENGINE_MODEL_QUEUE}]`, error)
  })

  return [autopilotWorker, seriesWorker, modelWorker]
}
