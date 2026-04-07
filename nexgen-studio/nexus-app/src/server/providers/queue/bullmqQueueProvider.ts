import { Queue } from 'bullmq'
import { QueueProvider, type QueueJobPayload } from '@/server/providers/types'
import { toBullMqQueueName } from './queueName'

const queues = new Map<string, Queue>()

function loadRedis() {
  const req = eval('require') as NodeRequire
  return req('ioredis')
}

function redisConnectionOptions() {
  return {
    connectTimeout: 5_000,
    maxRetriesPerRequest: null as null,
    retryStrategy(times: number) {
      return times > 1 ? null : 100
    },
  }
}

function buildConnection() {
  if (process.env.REDIS_URL) {
    const IORedis = loadRedis()
    return new IORedis(process.env.REDIS_URL, redisConnectionOptions())
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    ...redisConnectionOptions(),
  }
}

function getQueue(queueName: string) {
  const normalizedQueueName = toBullMqQueueName(queueName)
  const existing = queues.get(normalizedQueueName)
  if (existing) {
    return existing
  }

  const queue = new Queue(normalizedQueueName, {
    connection: buildConnection(),
  })
  queues.set(normalizedQueueName, queue)
  return queue
}

export class BullMqQueueProvider implements QueueProvider {
  async enqueue(queueName: string, payload: QueueJobPayload) {
    await getQueue(queueName).add(payload.type, payload, {
      removeOnComplete: 200,
      removeOnFail: 200,
    })
  }

  async depth(queueName: string): Promise<number> {
    try {
      const queue = getQueue(queueName)
      // Cast to any to access BullMQ internal methods
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = queue as any
      // Get waiting + delayed + paused counts
      const [waiting, delayed, paused] = await Promise.all([
        q.getWaitingCount?.() ?? Promise.resolve(0),
        q.getDelayedCount?.() ?? Promise.resolve(0),
        q.getPausedCount?.() ?? Promise.resolve(0),
      ])
      return (waiting || 0) + (delayed || 0) + (paused || 0)
    } catch (error) {
      console.error(`Failed to get queue depth for ${queueName}:`, error)
      return 0
    }
  }
}
