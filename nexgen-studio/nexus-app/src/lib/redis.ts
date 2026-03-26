import Redis from 'ioredis'

let shared: Redis | null = null

export function getRedis(): Redis | null {
  const url = process.env.REDIS_URL
  if (!url) {
    return null
  }
  if (!shared) {
    shared = new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    })
  }
  return shared
}

export function getRedisRequired(): Redis {
  const r = getRedis()
  if (!r) {
    throw new Error('REDIS_URL is not configured')
  }
  return r
}
