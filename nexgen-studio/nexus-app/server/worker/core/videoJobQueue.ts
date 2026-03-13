import { Queue } from 'bullmq'
import { toBullMqQueueName } from '../../../src/server/providers/queue/queueName'

let queue: Queue | null = null

function requireRedisUrl() {
  const value = process.env.REDIS_URL
  if (!value) {
    throw new Error('Missing required env var: REDIS_URL')
  }
  return value
}

function loadRedis() {
  const req = eval('require') as NodeRequire
  return req('ioredis')
}

function getQueue() {
  if (queue) {
    return queue
  }

  const IORedis = loadRedis()
  queue = new Queue(toBullMqQueueName('video:jobs'), {
    connection: new IORedis(requireRedisUrl(), { maxRetriesPerRequest: null }),
  })

  return queue
}

export async function enqueueVideoJobRefresh(videoJobId: string, delayMs = 5000) {
  await getQueue().add(
    'video-job.refresh',
    { id: videoJobId, type: 'video-job.refresh' },
    {
      delay: delayMs,
      removeOnComplete: 200,
      removeOnFail: 200,
    }
  )
}
