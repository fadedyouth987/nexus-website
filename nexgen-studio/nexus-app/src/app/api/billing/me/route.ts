import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { TIER_PLANS } from '@/lib/billing/tierPlans'

type CreditLedgerRow = { delta: number | string | null }

export async function GET(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const userId = token.sub

  try {
    const admin = getEngineSupabaseAdmin()

    const [profileResult, ledgerResult] = await Promise.all([
      admin
        .from('blueprint_users')
        .select('stripe_customer_id, stripe_subscription_id, plan, plan_status, plan_renews_at')
        .eq('id', userId)
        .maybeSingle(),
      admin.from('credit_ledger').select('delta').eq('user_id', userId),
    ])

    const stripeCustomerId = profileResult.data?.stripe_customer_id ?? null
    const stripeSubscriptionId = profileResult.data?.stripe_subscription_id ?? null
    const plan = profileResult.data?.plan ?? 'STARTER'
    const planStatus = profileResult.data?.plan_status ?? 'ACTIVE'
    const planRenewsAt = profileResult.data?.plan_renews_at ?? null
    const rows = (ledgerResult.data ?? []) as CreditLedgerRow[]
    const balance = rows.reduce((sum, row) => sum + Number(row.delta ?? 0), 0)
    const normalizedPlan = String(plan).toUpperCase()
    const monthlyTokenAllowance =
      normalizedPlan === 'STARTER'
        ? TIER_PLANS.tier1.monthlyTokens
        : normalizedPlan === 'PRO'
          ? TIER_PLANS.tier2.monthlyTokens
          : normalizedPlan === 'VAULT'
            ? TIER_PLANS.tier3.monthlyTokens
            : normalizedPlan === 'ENTERPRISE'
              ? TIER_PLANS.enterprise.monthlyTokens
              : 0

    return NextResponse.json({
      balance: Math.floor(balance),
      tokenBalance: Math.floor(balance),
      monthlyTokenAllowance,
      stripeCustomerId,
      stripeSubscriptionId,
      plan: String(plan),
      planStatus: String(planStatus),
      planRenewsAt,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load billing'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
