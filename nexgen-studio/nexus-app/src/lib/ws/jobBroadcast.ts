import { getRedis } from '@/lib/redis'

export async function publishJobUpdate(jobId: string, data: Record<string, unknown>): Promise<void> {
  const redis = getRedis()
  if (!redis) {
    return
  }
  await redis.publish('job-updates', JSON.stringify({ jobId, data }))
}
