import 'dotenv/config'
import { Worker, type Job } from 'bullmq'
import { processGenerationJob } from '@/workers/processGenerationJob'

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

const worker = new Worker<{ jobId: string }>(
  'generation-jobs',
  async (job: Job<{ jobId: string }>) => {
    const jobId = job.data?.jobId
    if (!jobId) {
      throw new Error('Missing jobId in queue payload')
    }
    const maxAttempts = job.opts.attempts ?? 3
    await processGenerationJob(jobId, {
      attemptsMade: job.attemptsMade,
      maxAttempts,
    })
  },
  { connection, concurrency: 1 }
)

worker.on('failed', (job, err) => {
  console.error('[worker] job failed', job?.id, err)
})

worker.on('completed', (job) => {
  console.info('[worker] completed', job.id)
})

console.info('[worker] Generation worker ready (queue: generation-jobs)')
