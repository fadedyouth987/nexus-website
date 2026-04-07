import { Queue } from 'bullmq'
import { normalizePlan } from '@/lib/billing/planLimits'

let queues: Map<string, Queue> = new Map()

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

function getQueueName(planSlug: string): string {
  const plan = normalizePlan(planSlug)
  switch (plan) {
    case 'ENTERPRISE':
      return 'generation-jobs-critical'
    case 'PROFESSIONAL':
      return 'generation-jobs-high'
    default:
      return 'generation-jobs'
  }
}

function getOrCreateQueue(queueName: string): Queue {
  if (!queues.has(queueName)) {
    queues.set(queueName, new Queue(queueName, {
      connection: redisConnectionOptions(),
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }))
  }
  return queues.get(queueName)!
}

export function getGenerationQueue(planSlug?: string): Queue | null {
  if (!process.env.REDIS_URL) {
    return null
  }
  const queueName = planSlug ? getQueueName(planSlug) : 'generation-jobs'
  return getOrCreateQueue(queueName)
}

export function getAllGenerationQueues(): Queue[] {
  if (!process.env.REDIS_URL) {
    return []
  }
  return [
    getOrCreateQueue('generation-jobs-critical'),
    getOrCreateQueue('generation-jobs-high'),
    getOrCreateQueue('generation-jobs'),
  ]
}

export async function enqueueGenerationJob(
  jobId: string,
  options?: { planSlug?: string; priority?: number }
): Promise<void> {
  const queueName = options?.planSlug ? getQueueName(options.planSlug) : 'generation-jobs'
  const queue = getOrCreateQueue(queueName)

  const priorityMap: Record<string, number> = { critical: 1, high: 2, normal: 3, low: 4 }
  const priority = options?.priority ?? priorityMap.normal

  await queue.add(
    'process',
    { jobId, priority_queue: queueName },
    {
      jobId,
      priority,
      removeOnComplete: true,
      removeOnFail: false,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    }
  )
}

export async function getQueueMetrics(): Promise<Record<string, { waiting: number; active: number; completed: number; failed: number }>> {
  const metrics: Record<string, { waiting: number; active: number; completed: number; failed: number }> = {}

  for (const [name, queue] of queues) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ])
    metrics[name] = { waiting, active, completed, failed }
  }

  return metrics
}
