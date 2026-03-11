import { NextResponse } from 'next/server'
import { TOKEN_COST_MATRIX, TOKEN_COST_CATALOG } from '@/lib/billing/tokenCosts'
import { TIER_PLANS } from '@/lib/billing/tierPlans'

export async function GET() {
  const tierTokenAllowances = Object.fromEntries(
    Object.values(TIER_PLANS).map((p) => [p.id, { label: p.title, monthlyTokens: p.monthlyTokens, monthlyPrice: p.monthlyPrice, annualPrice: p.annualPrice, storageGb: p.storageGb }]),
  )

  const categories = [...new Set(TOKEN_COST_CATALOG.map((c) => c.category))]

  return NextResponse.json({
    tokenCostMatrix: TOKEN_COST_MATRIX,
    catalog: TOKEN_COST_CATALOG,
    categories,
    tierTokenAllowances,
    topup: TOKEN_COST_MATRIX.topup,
  })
}

