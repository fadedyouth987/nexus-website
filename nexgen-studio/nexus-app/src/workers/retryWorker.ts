/**
 * Retry worker: re-queues failed publish jobs for retry (e.g. temporary platform failures).
 * Can be triggered by a cron or by re-adding failed job payloads to the publish queue.
 * Run with: npx tsx src/workers/retryWorker.ts
 */

import { Worker } from 'bullmq'
import { getPublishQueue } from '@/lib/social/queue'
import type { PublishJobPayload } from '@/lib/social/queue'

const REDIS_URL = process.env.REDIS_URL
if (!REDIS_URL) {
  console.error('REDIS_URL required for retry worker')
  process.exit(1)
}

const connection = (() => {
  try {
    const u = new URL(REDIS_URL)
    return {
      host: u.hostname,
      port: parseInt(u.port || '6379', 10),
      password: u.password || undefined,
      maxRetriesPerRequest: null,
    }
  } catch {
    return null
  }
})()

if (!connection) {
  console.error('Invalid REDIS_URL')
  process.exit(1)
}

const MAX_RETRIES = 3

const worker = new Worker(
  'social-retry',
  async (job) => {
    const payload = job.data
    const attempt = Number(payload.retryCount || 0)
    console.log('[retryWorker] Retry attempt', attempt, payload.jobId)
    if (attempt >= MAX_RETRIES) {
      console.log('[retryWorker] Max retries exceeded, skipping', payload.jobId)
      return
    }
    const publishQueue = getPublishQueue()
    if (publishQueue) {
      const nextAttempt = attempt + 1
      await publishQueue.add(
        'retry',
        { ...payload, retryCount: nextAttempt },
        { delay: nextAttempt * 60 * 1000 }
      )
    }
  },
  { connection }
)

worker.on('completed', (job) => {
  console.log('[retryWorker] Completed', job.id)
})

worker.on('failed', (job, err) => {
  console.error('[retryWorker] Failed', job?.id, err.message)
})

console.log('[retryWorker] Listening for jobs on queue social-retry')
