import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { createClient } from '@/lib/supabase/server'
import { logGenerationFailure } from '@/lib/logging/generationFailure'
import { GET } from './route'

type MockClient = Pick<SupabaseClient, 'from'>

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

vi.mock('@/lib/logging/generationFailure', () => ({
  getRequestId: () => 'test-request-id',
  logGenerationFailure: vi.fn(),
}))

function tripleEqThenMaybe<T>(result: T) {
  return {
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => result,
          }),
        }),
      }),
    }),
  }
}

function doubleEqLimitMaybe<T>(result: T) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    limit: () => chain,
    maybeSingle: async () => result,
  }
  return chain
}

function orgSelectMaybe<T>(result: T) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => result,
      }),
    }),
  }
}

function planSelectMaybe<T>(result: T) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: async () => result,
      }),
    }),
  }
}

function billingSupabaseSuccess(orgId: string, opts?: { memberDenied?: boolean }) {
  return {
    from(table: string) {
      if (table === 'organization_members') {
        if (opts?.memberDenied) {
          return tripleEqThenMaybe({ data: null, error: null })
        }
        return tripleEqThenMaybe({ data: { org_id: orgId }, error: null })
      }
      if (table === 'organizations') {
        return orgSelectMaybe({
          data: { plan_id: 'plan-1', token_balance: 42 },
          error: null,
        })
      }
      if (table === 'subscription_plans') {
        return planSelectMaybe({ data: { slug: 'professional' }, error: null })
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
}

describe('GET /api/billing/me', () => {
  beforeEach(() => {
    vi.mocked(getServerSession).mockReset()
    vi.mocked(createClient).mockReset()
    vi.mocked(logGenerationFailure).mockReset()
  })

  it('returns 401 when there is no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET(new Request('http://localhost/api/billing/me'))
    expect(res.status).toBe(401)
  })

  it('returns 403 and logs when org_id query is set but user is not a member', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof getServerSession>>)
    vi.mocked(createClient).mockResolvedValue(
      billingSupabaseSuccess('org-x', { memberDenied: true }) as unknown as Awaited<
        ReturnType<typeof createClient>
      >
    )

    const res = await GET(new Request('http://localhost/api/billing/me?org_id=org-x'))
    expect(res.status).toBe(403)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toBe('Forbidden')

    expect(logGenerationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'billing_failure',
        code: 'BILLING_ORG_FORBIDDEN',
        requestedOrgId: 'org-x',
        userId: 'user-1',
      })
    )
  })

  it('returns org-scoped plan and token balance when org_id is valid', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof getServerSession>>)
    vi.mocked(createClient).mockResolvedValue(
      billingSupabaseSuccess('org-scoped') as unknown as Awaited<ReturnType<typeof createClient>>
    )

    const res = await GET(new Request('http://localhost/api/billing/me?org_id=org-scoped'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { plan?: string; tokenBalance?: number }
    expect(body.plan).toBe('PROFESSIONAL')
    expect(body.tokenBalance).toBe(42)
  })

  it('uses primary org when org_id query is omitted', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof getServerSession>>)
    vi.mocked(createClient).mockResolvedValue({
      from(table: string) {
        if (table === 'organization_members') {
          return doubleEqLimitMaybe({ data: { org_id: 'org-primary' }, error: null })
        }
        if (table === 'organizations') {
          return orgSelectMaybe({
            data: { plan_id: 'plan-1', token_balance: 99 },
            error: null,
          })
        }
        if (table === 'subscription_plans') {
          return planSelectMaybe({ data: { slug: 'starter' }, error: null })
        }
        throw new Error(`unexpected table ${table}`)
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const res = await GET(new Request('http://localhost/api/billing/me'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { plan?: string; tokenBalance?: number }
    expect(body.plan).toBe('STARTER')
    expect(body.tokenBalance).toBe(99)
  })

  it('returns starter defaults when user has no org membership', async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: 'user-1' },
    } as Awaited<ReturnType<typeof getServerSession>>)
    vi.mocked(createClient).mockResolvedValue({
      from(table: string) {
        if (table === 'organization_members') {
          return doubleEqLimitMaybe({ data: null, error: null })
        }
        throw new Error(`unexpected table ${table}`)
      },
    } as unknown as Awaited<ReturnType<typeof createClient>>)

    const res = await GET(new Request('http://localhost/api/billing/me'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { plan?: string; tokenBalance?: null }
    expect(body.plan).toBe('STARTER')
    expect(body.tokenBalance).toBeNull()
  })
})
