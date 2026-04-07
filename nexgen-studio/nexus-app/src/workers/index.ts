import 'dotenv/config'
import { Worker, type Job } from 'bullmq'
import { processGenerationJob } from '@/workers/processGenerationJob'
import { moveToDeadLetterQueue } from '@/lib/automation/deadLetterQueue'
import { withCircuitBreaker, CircuitBreakerError } from '@/lib/automation/circuitBreaker'
import { recoverInterruptedJobs } from '@/lib/automation/jobRecovery'
import { createServiceClient } from '@/lib/supabase/service'

const url = process.env.REDIS_URL
if (!url) {
  console.error('REDIS_URL is required for the generation worker.')
  process.exit(1)
}

const connection = {
  url,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
}

async function runStartupRecovery() {
  try {
    console.info('[worker] Running startup job recovery...')
    const result = await recoverInterruptedJobs()
    console.info(`[worker] Recovery complete: ${result.recoveredCount} recovered, ${result.failedCount} failed`)
  } catch (error) {
    console.error('[worker] Startup recovery failed:', error)
  }
}

function createWorker(queueName: string) {
  const worker = new Worker<{ jobId: string }>(
    queueName,
    async (job: Job<{ jobId: string }>) => {
      const jobId = job.data?.jobId
      if (!jobId) {
        throw new Error('Missing jobId in queue payload')
      }

      const maxAttempts = job.opts.attempts ?? 3
      const attemptNumber = job.attemptsMade + 1

      try {
        await withCircuitBreaker('comfyui', async () => {
          await processGenerationJob(jobId, {
            attemptsMade: job.attemptsMade,
            maxAttempts,
          })
        })
      } catch (error) {
        if (error instanceof CircuitBreakerError) {
          console.error(`[worker] circuit breaker open for comfyui, job ${jobId} rejected`)
          const service = createServiceClient()
          const { data: jobData } = await service
            .from('generation_jobs')
            .select('org_id, user_id, input_params')
            .eq('id', jobId)
            .single()

          if (jobData) {
            await moveToDeadLetterQueue(
              jobId,
              jobData.org_id,
              jobData.user_id,
              new Error('Circuit breaker open for ComfyUI'),
              jobData.input_params as Record<string, unknown>,
              attemptNumber,
              maxAttempts
            )
          }
          throw error
        }

        if (attemptNumber >= maxAttempts) {
          const service = createServiceClient()
          const { data: jobData } = await service
            .from('generation_jobs')
            .select('org_id, user_id, input_params')
            .eq('id', jobId)
            .single()

          if (jobData) {
            await moveToDeadLetterQueue(
              jobId,
              jobData.org_id,
              jobData.user_id,
              error instanceof Error ? error : new Error(String(error)),
              jobData.input_params as Record<string, unknown>,
              attemptNumber,
              maxAttempts
            )
          }
        }

        throw error
      }
    },
    { connection, concurrency: 1 }
  )

  worker.on('failed', (job, err) => {
    console.error(`[worker:${queueName}] job failed`, job?.id, err.message)
  })

  worker.on('completed', (job) => {
    console.info(`[worker:${queueName}] completed`, job.id)
  })

  return worker
}

const workers = [
  createWorker('generation-jobs-critical'),
  createWorker('generation-jobs-high'),
  createWorker('generation-jobs'),
]

console.info('[worker] Generation workers ready (queues: generation-jobs-critical, generation-jobs-high, generation-jobs)')

runStartupRecovery()

process.on('SIGTERM', async () => {
  console.info('[worker] Shutting down...')
  await Promise.all(workers.map(w => w.close()))
  process.exit(0)
})

process.on('SIGINT', async () => {
  console.info('[worker] Shutting down...')
  await Promise.all(workers.map(w => w.close()))
  process.exit(0)
})
