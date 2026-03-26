import { describe, expect, it } from 'vitest'
import { resolveGenerationOrgId, stripGenerationRequestMeta } from './org'
import type { SupabaseClient } from '@supabase/supabase-js'

function membersChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    limit: () => chain,
    maybeSingle: async () => result,
  }
  return chain
}

function supabaseForMembers(result: { data: unknown; error: unknown }): SupabaseClient {
  return {
    from(table: string) {
      if (table !== 'organization_members') {
        throw new Error(`unexpected table ${table}`)
      }
      return membersChain(result) as unknown as ReturnType<SupabaseClient['from']>
    },
  } as unknown as SupabaseClient
}

describe('stripGenerationRequestMeta', () => {
  it('removes org_id and orgId and preserves other fields', () => {
    const body = {
      org_id: '11111111-1111-1111-1111-111111111111',
      orgId: '22222222-2222-2222-2222-222222222222',
      positive: 'a cat',
      batch_size: 2,
      nested: { x: 1 },
    }
    const out = stripGenerationRequestMeta(body)
    expect(out).toEqual({
      positive: 'a cat',
      batch_size: 2,
      nested: { x: 1 },
    })
    expect(out).not.toHaveProperty('org_id')
    expect(out).not.toHaveProperty('orgId')
  })
})

describe('resolveGenerationOrgId', () => {
  const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  const orgId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

  it('returns org when user is an active member of requested org', async () => {
    const supabase = supabaseForMembers({ data: { org_id: orgId }, error: null })
    const r = await resolveGenerationOrgId(supabase, userId, orgId)
    expect(r).toEqual({ ok: true, orgId })
  })

  it('ignores non-string requested org and uses primary membership', async () => {
    const supabase = supabaseForMembers({ data: { org_id: orgId }, error: null })
    const r = await resolveGenerationOrgId(supabase, userId, 12345)
    expect(r).toEqual({ ok: true, orgId })
  })

  it('returns 403-style detail when requested org but not a member', async () => {
    const supabase = supabaseForMembers({ data: null, error: null })
    const r = await resolveGenerationOrgId(supabase, userId, orgId)
    expect(r).toEqual({ ok: false, detail: 'Not a member of this organization' })
  })

  it('returns same detail when Supabase returns an error', async () => {
    const supabase = supabaseForMembers({ data: null, error: { message: 'db' } })
    const r = await resolveGenerationOrgId(supabase, userId, orgId)
    expect(r).toEqual({ ok: false, detail: 'Not a member of this organization' })
  })

  it('trims requested org id string', async () => {
    const supabase = supabaseForMembers({ data: { org_id: orgId }, error: null })
    const r = await resolveGenerationOrgId(supabase, userId, `  ${orgId}  `)
    expect(r).toEqual({ ok: true, orgId })
  })

  it('falls back to first membership when requested id missing', async () => {
    const supabase = supabaseForMembers({ data: { org_id: orgId }, error: null })
    const r = await resolveGenerationOrgId(supabase, userId, undefined)
    expect(r).toEqual({ ok: true, orgId })
  })

  it('falls back when requested is empty string', async () => {
    const supabase = supabaseForMembers({ data: { org_id: orgId }, error: null })
    const r = await resolveGenerationOrgId(supabase, userId, '   ')
    expect(r).toEqual({ ok: true, orgId })
  })

  it('returns no membership when fallback has no row', async () => {
    const supabase = supabaseForMembers({ data: null, error: null })
    const r = await resolveGenerationOrgId(supabase, userId, null)
    expect(r).toEqual({ ok: false, detail: 'No organization membership' })
  })
})
