import { getRedis } from '@/lib/redis'

export type RateLimitRule = { requests: number; windowSeconds: number }

const memoryCounts = new Map<string, { count: number; resetAt: number }>()

/**
 * Fixed-window limiter. Uses Redis when REDIS_URL is set; otherwise in-memory (dev only).
 */
export async function checkRateLimit(
  key: string,
  rule: RateLimitRule
): Promise<{ ok: true; remaining: number; resetIn: number } | { ok: false; retryAfter: number }> {
  const redis = getRedis()
  const now = Date.now()
  const windowMs = rule.windowSeconds * 1000

  if (redis) {
    const k = `rate-limit:${key}`
    const n = await redis.incr(k)
    if (n === 1) {
      await redis.pexpire(k, windowMs)
    }
    const ttl = await redis.pttl(k)
    const resetIn = ttl > 0 ? Math.ceil(ttl / 1000) : rule.windowSeconds
    if (n > rule.requests) {
      return { ok: false, retryAfter: resetIn }
    }
    return { ok: true, remaining: Math.max(0, rule.requests - n), resetIn }
  }

  const slot = Math.floor(now / windowMs)
  const memKey = `${key}:${slot}`
  const entry = memoryCounts.get(memKey)
  if (!entry || entry.resetAt <= now) {
    memoryCounts.set(memKey, { count: 1, resetAt: (slot + 1) * windowMs })
    return { ok: true, remaining: rule.requests - 1, resetIn: rule.windowSeconds }
  }
  entry.count += 1
  if (entry.count > rule.requests) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) }
  }
  return { ok: true, remaining: rule.requests - entry.count, resetIn: Math.ceil((entry.resetAt - now) / 1000) }
}

export const RATE_LIMITS: Record<string, RateLimitRule> = {
  '/api/ai/generate-image': { requests: 10, windowSeconds: 60 },
  '/api/assets/upload': { requests: 30, windowSeconds: 60 },
  '/api/workflows': { requests: 60, windowSeconds: 60 },
}
