import { Queue } from 'bullmq'
import { QueueProvider, type QueueJobPayload } from '@/server/providers/types'
import { toBullMqQueueName } from './queueName'

const queues = new Map<string, Queue>()

function getQueue(queueName: string) {
  const normalizedQueueName = toBullMqQueueName(queueName)
  const existing = queues.get(normalizedQueueName)
  if (existing) {
    return existing
  }

  const connection = {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null as null,
  }

  const queue = new Queue(normalizedQueueName, { connection })
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
}
