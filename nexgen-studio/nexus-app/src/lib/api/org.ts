/** Org resolution + meta stripping for generation jobs. @see docs/application-flow.md */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Remove API-only fields before persisting job input_params / Comfy payload. */
export function stripGenerationRequestMeta(body: Record<string, unknown>): Record<string, unknown> {
  const { org_id: _a, orgId: _b, ...rest } = body
  return rest
}

/**
 * Resolves which org a generation request runs under.
 * If `requestedOrgId` is set, the user must be an active member of that org.
 * Otherwise falls back to the user's first membership (legacy / clients without org context).
 */
export async function resolveGenerationOrgId(
  supabase: SupabaseClient,
  userId: string,
  requestedOrgId: unknown
): Promise<{ ok: true; orgId: string } | { ok: false; detail: string }> {
  const raw =
    typeof requestedOrgId === 'string' && requestedOrgId.trim().length > 0
      ? requestedOrgId.trim()
      : null

  if (raw) {
    const { data, error } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', userId)
      .eq('org_id', raw)
      .eq('is_active', true)
      .maybeSingle()

    if (error || !data?.org_id) {
      return { ok: false, detail: 'Not a member of this organization' }
    }
    return { ok: true, orgId: data.org_id }
  }

  const fallback = await getPrimaryOrgId(supabase, userId)
  if (!fallback) {
    return { ok: false, detail: 'No organization membership' }
  }
  return { ok: true, orgId: fallback }
}

export async function getPrimaryOrgId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error || !data?.org_id) {
    return null
  }
  return data.org_id
}

export async function getOrgPlanSlug(
  supabase: SupabaseClient,
  orgId: string
): Promise<string> {
  const { data: org } = await supabase.from('organizations').select('plan_id').eq('id', orgId).maybeSingle()

  if (!org?.plan_id) {
    return 'starter'
  }

  const { data: plan } = await supabase
    .from('subscription_plans')
    .select('slug')
    .eq('id', org.plan_id)
    .maybeSingle()

  return plan?.slug ?? 'starter'
}
