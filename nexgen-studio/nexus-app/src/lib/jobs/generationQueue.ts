import { Queue } from 'bullmq'

let queue: Queue | null = null

function redisConnectionOptions() {
  const url = process.env.REDIS_URL
  if (!url) {
    throw new Error('REDIS_URL is not set')
  }
  return {
    url,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  }
}

export function getGenerationQueue(): Queue | null {
  if (!process.env.REDIS_URL) {
    return null
  }
  if (!queue) {
    queue = new Queue('generation-jobs', {
      connection: redisConnectionOptions(),
    })
  }
  return queue
}

export async function enqueueGenerationJob(jobId: string): Promise<void> {
  const q = getGenerationQueue()
  if (!q) {
    throw new Error('Redis queue is not configured')
  }
  await q.add(
    'process',
    { jobId },
    {
      jobId,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  )
}
