import { describe, it, expect } from 'vitest'
import { checkRateLimit, getIdentifier } from '../core/rateLimit'

describe('rateLimit', () => {
  it('getIdentifier uses userId when provided', () => {
    const req = new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: {},
    })
    expect(getIdentifier(req, 'user-123')).toBe('user:user-123')
  })

  it('getIdentifier uses ip when userId is null', () => {
    const req = new Request('http://localhost/api/auth/signin', {
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.1' },
    })
    expect(getIdentifier(req, null)).toBe('ip:192.168.1.1')
  })

  it('checkRateLimit allows requests under the limit', () => {
    const id = 'test-user-1'
    const first = checkRateLimit(id)
    expect(first.ok).toBe(true)
    expect(first.remaining).toBeLessThanOrEqual(30)
  })

  it('checkRateLimit rejects after limit exceeded', () => {
    const id = `exceed-${Date.now()}-${Math.random()}`
    let result = { ok: true, remaining: 30 }
    for (let i = 0; i < 35; i++) {
      result = checkRateLimit(id)
      if (!result.ok) break
    }
    expect(result.ok).toBe(false)
    expect(result.remaining).toBe(0)
  })
})
