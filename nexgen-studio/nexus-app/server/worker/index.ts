import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { Worker } from 'bullmq'
import { getWorkerRedis } from './core/redis'
import { processGeneration } from './processors/processGeneration'
import { processSafeImageV2Job } from './processors/processSafeImageV2'
import { publishDueSchedules } from './processors/publishScheduledContent'
import { ingestPerformanceSnapshots } from './processors/ingestPerformance'
import { comfyuiWarnIfUnreachable } from '../../src/lib/server/comfyui'
import { startEngineWorkers } from './engines/engineQueue'

function concurrency(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

import { logger } from './core/logger'

function startWorker(queueName: string, conc: number) {
  const connection = getWorkerRedis()
  const worker = new Worker(
    queueName,
    async (job: any) => {
      const payload = job.data as
        | {
            jobId?: string
            kind?: string
            org_id?: string
            workspace_id?: string
            content_id?: string
            prompt?: string
            requested_at?: string
            requested_by?: string | null
          }
        | undefined

      if (queueName === 'generation:safe:image' && payload?.kind === 'content_v2_safe_image') {
        logger.info(`Processing safe image job`, { content_id: payload.content_id })
        await processSafeImageV2Job({
          kind: 'content_v2_safe_image',
          org_id: String(payload.org_id || ''),
          workspace_id: String(payload.workspace_id || ''),
          content_id: String(payload.content_id || ''),
          prompt: typeof payload.prompt === 'string' ? payload.prompt : '',
          requested_at: typeof payload.requested_at === 'string' ? payload.requested_at : undefined,
          requested_by: typeof payload.requested_by === 'string' ? payload.requested_by : null,
        })
        return
      }

      if (typeof payload?.jobId !== 'string' || !payload.jobId) {
        throw new Error(`Unsupported queue payload for ${queueName}`)
      }

      logger.info(`Processing generation job`, { jobId: payload.jobId })
      await processGeneration(payload.jobId)
    },
    {
      connection,
      concurrency: conc,
    }
  )

  worker.on('error', (error: unknown) => {
    logger.error(`Worker error: ${queueName}`, { error })
  })

  return worker
}

function everyMs(name: string, fallbackMs: number) {
  const value = Number(process.env[name] || fallbackMs)
  return Number.isFinite(value) && value > 0 ? value : fallbackMs
}

function hasWorkerAdminConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

function startIntervalJob(name: string, intervalMs: number, job: () => Promise<{ processed: number }>) {
  let running = false

  const run = async () => {
    if (running) return
    running = true
    try {
      const result = await job()
      if (result.processed > 0) {
        logger.info(`Processed interval job: ${name}`, { processed: result.processed })
      }
    } catch (error) {
      logger.error(`Interval job failed: ${name}`, { error })
    } finally {
      running = false
    }
  }

  const timer = setInterval(() => {
    void run()
  }, intervalMs)

  void run()

  return () => clearInterval(timer)
}

const workers = [
  startWorker('generation:safe:image', concurrency('CONC_SAFE_IMAGE', 1)),
  startWorker('generation:safe:video', concurrency('CONC_SAFE_VIDEO', 1)),
  startWorker('generation:vault:image', concurrency('CONC_VAULT_IMAGE', 1)),
  startWorker('generation:vault:video', concurrency('CONC_VAULT_VIDEO', 1)),
  ...startEngineWorkers(),
]

let stopPublisher = () => {}
let stopPerformanceIngestion = () => {}

if (hasWorkerAdminConfig()) {
  stopPublisher = startIntervalJob(
    'schedule-publisher',
    everyMs('SCHEDULE_PUBLISH_INTERVAL_MS', 15_000),
    () => publishDueSchedules(25)
  )

  stopPerformanceIngestion = startIntervalJob(
    'performance-ingestion',
    everyMs('PERFORMANCE_INGEST_INTERVAL_MS', 60_000),
    () => ingestPerformanceSnapshots(100)
  )
} else {
  logger.warn(
    'Schedule publisher and performance ingestion are disabled (missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)'
  )
}

process.on('SIGINT', async () => {
  stopPublisher()
  stopPerformanceIngestion()
  await Promise.all(workers.map((worker) => worker.close()))
  process.exit(0)
})

logger.info('Blueprint worker started')
void comfyuiWarnIfUnreachable()
