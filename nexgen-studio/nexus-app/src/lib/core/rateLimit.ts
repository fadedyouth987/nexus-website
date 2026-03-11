/**
 * Simple in-memory rate limiter for API routes.
 * Use for /api/generate, /api/auth, etc. For production consider Redis.
 */

const store = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60 * 1000
const MAX_PER_WINDOW = 30

function getKey(identifier: string): string {
  return identifier
}

export function checkRateLimit(identifier: string): { ok: boolean; remaining: number } {
  const now = Date.now()
  const key = getKey(identifier)
  let entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS }
    store.set(key, entry)
    return { ok: true, remaining: MAX_PER_WINDOW - 1 }
  }

  entry.count += 1
  if (entry.count > MAX_PER_WINDOW) {
    return { ok: false, remaining: 0 }
  }
  return { ok: true, remaining: MAX_PER_WINDOW - entry.count }
}

export function getIdentifier(request: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
}
