import { describe, expect, it } from 'vitest'
import { parseWaitlistBody } from './waitlistBody'

describe('parseWaitlistBody', () => {
  it('accepts the landing page payload shape', () => {
    const result = parseWaitlistBody({
      email: 'user@example.com',
      name: 'User',
      contentGoals: 'More reels',
      source: 'landing_beta_invite',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
    }
  })

  it('rejects invalid email', () => {
    const result = parseWaitlistBody({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })
})
