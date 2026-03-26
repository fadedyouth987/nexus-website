import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { createClient } from '@/lib/supabase/server'
import { getOrgPlanSlug, getPrimaryOrgId } from '@/lib/api/org'
import { normalizePlan } from '@/lib/billing/planLimits'
import { getRequestId, logGenerationFailure } from '@/lib/logging/generationFailure'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requestId = getRequestId(request)
  const userId = session.user.id

  const supabase = await createClient()
  const requested = new URL(request.url).searchParams.get('org_id')

  let orgId: string | null = null
  if (requested) {
    const { data, error } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', userId)
      .eq('org_id', requested)
      .eq('is_active', true)
      .maybeSingle()
    if (error || !data?.org_id) {
      logGenerationFailure({
        event: 'billing_failure',
        requestId,
        userId,
        requestedOrgId: requested,
        provider: 'billing',
        code: 'BILLING_ORG_FORBIDDEN',
        message: error?.message ?? 'Not a member of requested organization',
      })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    orgId = data.org_id
  } else {
    orgId = await getPrimaryOrgId(supabase, userId)
  }

  if (!orgId) {
    return NextResponse.json({ plan: 'STARTER', tokenBalance: null })
  }

  const planSlug = await getOrgPlanSlug(supabase, orgId)
  const { data: org } = await supabase
    .from('organizations')
    .select('token_balance')
    .eq('id', orgId)
    .maybeSingle()

  return NextResponse.json({
    plan: normalizePlan(planSlug),
    tokenBalance: typeof org?.token_balance === 'number' ? org.token_balance : null,
  })
}
