/**
 * BullMQ queues for publish, analytics, and retry.
 * Uses REDIS_URL; queues are optional when Redis is not configured.
 */

let Queue: typeof import('bullmq').Queue
let Worker: typeof import('bullmq').Worker
let connection: { host: string; port: number; password?: string } | null = null

function loadBullMQ() {
  if (typeof Queue !== 'undefined') return { Queue, Worker }
  const bullmq = require('bullmq') as typeof import('bullmq')
  Queue = bullmq.Queue
  Worker = bullmq.Worker
  return { Queue, Worker }
}

function getConnection() {
  if (connection) return connection
  const url = process.env.REDIS_URL
  if (!url) return null
  try {
    const u = new URL(url)
    connection = {
      host: u.hostname,
      port: parseInt(u.port || '6379', 10),
      password: u.password || undefined,
    }
  } catch {
    connection = null
  }
  return connection
}

export const PUBLISH_QUEUE_NAME = 'social-publish'
export const ANALYTICS_QUEUE_NAME = 'social-analytics'
export const RETRY_QUEUE_NAME = 'social-retry'

export interface PublishJobPayload {
  jobId: string
  userId: string
  socialAccountId: string
  provider: string
  caption: string
  mediaUrls: string[]
  scheduledFor?: string
  scheduleId?: string
  contentId?: string
  retryCount?: number
}

export interface AnalyticsJobPayload {
  socialAccountId: string
  provider: string
}

export function getPublishQueue(): InstanceType<typeof import('bullmq').Queue> | null {
  const conn = getConnection()
  if (!conn) return null
  const { Queue: Q } = loadBullMQ()
  return new Q(PUBLISH_QUEUE_NAME, {
    connection: { ...conn, maxRetriesPerRequest: null },
  })
}

export function getAnalyticsQueue(): InstanceType<typeof import('bullmq').Queue> | null {
  const conn = getConnection()
  if (!conn) return null
  const { Queue: Q } = loadBullMQ()
  return new Q(ANALYTICS_QUEUE_NAME, {
    connection: { ...conn, maxRetriesPerRequest: null },
  })
}

export function getRetryQueue(): InstanceType<typeof import('bullmq').Queue> | null {
  const conn = getConnection()
  if (!conn) return null
  const { Queue: Q } = loadBullMQ()
  return new Q(RETRY_QUEUE_NAME, {
    connection: { ...conn, maxRetriesPerRequest: null },
  })
}

export function isQueueAvailable(): boolean {
  return !!getConnection()
}
