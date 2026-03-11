import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { reserveCredits } from '@/lib/billing/credits'
import { estimateEditTokens } from '@/lib/billing/tokenCosts'
import { editBatchLimitByPlan, normalizePlan } from '@/lib/billing/planLimits'

/**
 * Queue edit operations (single or batch) for async processing.
 * This endpoint persists requests so UI workflows are real and trackable.
 */
export async function POST(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    tool?: string
    assetId?: string
    assetIds?: string[]
    params?: Record<string, unknown>
    recipeName?: string
  }

  const tool = String(body.tool || '').trim()
  const singleAssetId = String(body.assetId || '').trim()
  const batchAssetIds = Array.isArray(body.assetIds) ? body.assetIds.map((id) => String(id).trim()).filter(Boolean) : []
  const targetAssetIds = [...new Set([singleAssetId, ...batchAssetIds].filter(Boolean))]
  if (!tool) {
    return NextResponse.json({ detail: 'tool is required' }, { status: 400 })
  }
  if (targetAssetIds.length === 0) {
    return NextResponse.json({ detail: 'assetId or assetIds is required' }, { status: 400 })
  }

  const admin = getEngineSupabaseAdmin()
  const { data: profile } = await admin
    .from('blueprint_users')
    .select('plan, plan_status')
    .eq('id', token.sub)
    .maybeSingle()
  const plan = normalizePlan(profile?.plan)
  const batchLimit = editBatchLimitByPlan(plan)
  if (targetAssetIds.length > batchLimit) {
    return NextResponse.json(
      {
        detail: `Your ${plan} plan supports up to ${batchLimit} assets per edit batch.`,
        code: 'BATCH_LIMIT_EXCEEDED',
        plan,
        batchLimit,
      },
      { status: 403 }
    )
  }

  const tokensToReserve = estimateEditTokens(tool, targetAssetIds.length)
  const reserveRefId = `${tool}:${Date.now()}`
  const reserve = await reserveCredits({
    userId: token.sub,
    credits: tokensToReserve,
    refType: 'EDIT_JOB_BATCH',
    refId: reserveRefId,
  })
  if (!reserve.ok) {
    return NextResponse.json(
      {
        detail: reserve.message,
        code: reserve.code,
      },
      { status: reserve.code === 'INSUFFICIENT_CREDITS' ? 402 : 500 }
    )
  }

  const insertedJobs: Array<{ id: string; asset_id: string; status: string }> = []
  for (const assetId of targetAssetIds) {
    const { data, error } = await admin
      .from('edit_jobs')
      .insert({
        user_id: token.sub,
        asset_id: assetId,
        tool,
        params_json: body.params && typeof body.params === 'object' ? body.params : {},
        recipe_name: body.recipeName ? String(body.recipeName).slice(0, 120) : null,
        status: 'queued',
      })
      .select('id, asset_id, status')
      .single()
    if (!error && data?.id) {
      insertedJobs.push({
        id: String(data.id),
        asset_id: String(data.asset_id),
        status: String(data.status),
      })
    }
  }

  if (insertedJobs.length === 0) {
    await admin.from('credit_ledger').insert({
      user_id: token.sub,
      delta: reserve.reservedCredits,
      reason: 'RELEASE_RESERVE',
      ref_type: 'EDIT_JOB_BATCH',
      ref_id: `${reserveRefId}:refund`,
    })
    return NextResponse.json({ detail: 'Failed to queue edit jobs' }, { status: 500 })
  }

  return NextResponse.json(
    {
      ok: true,
      queued: insertedJobs.length,
      reservedTokens: reserve.reservedCredits,
      plan,
      batchLimit,
      jobs: insertedJobs,
      detail: 'Edit jobs queued. Processing worker can execute these jobs asynchronously.',
    },
    { status: 202 }
  )
}
