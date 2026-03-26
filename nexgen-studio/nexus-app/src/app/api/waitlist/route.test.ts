import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from './route'

describe('POST /api/waitlist', () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns 200 { ok: true } for valid JSON when Supabase is not configured (public signup)', async () => {
    const req = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'beta@example.com',
        name: 'Beta User',
        contentGoals: 'Test goals',
        source: 'landing_beta_invite',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns 400 for invalid email', async () => {
    const req = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'bad' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { detail?: string }
    expect(body.detail).toBeDefined()
  })

  it('persists via Supabase REST when env is set and returns ok on 201', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyz.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'

    fetchMock.mockResolvedValueOnce(new Response(null, { status: 201 }))

    const req = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'Save@Example.com',
        name: null,
        contentGoals: null,
        source: 'landing_beta_invite',
      }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    expect(call?.[0]).toBe('https://xyz.supabase.co/rest/v1/waitlist_signups')
    expect((call?.[1] as RequestInit)?.method).toBe('POST')
    const posted = JSON.parse(((call?.[1] as RequestInit)?.body as string) ?? '{}')
    expect(posted.email).toBe('save@example.com')
    expect(posted.source).toBe('landing_beta_invite')
  })

  it('returns duplicate success on 409 from Supabase', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyz.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'

    fetchMock.mockResolvedValueOnce(new Response('duplicate key', { status: 409 }))

    const req = new Request('http://localhost/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'dup@example.com' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, duplicate: true })
  })
})
