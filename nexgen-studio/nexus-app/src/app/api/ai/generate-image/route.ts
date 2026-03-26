/** Org-aware enqueue: `resolveGenerationOrgId`, usage, tokens, job row. @see docs/application-flow.md */
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getOrgPlanSlug, resolveGenerationOrgId, stripGenerationRequestMeta } from '@/lib/api/org'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { enqueueGenerationJob, getGenerationQueue } from '@/lib/jobs/generationQueue'
import { generationOutputLimitByPlan, normalizePlan } from '@/lib/billing/planLimits'
import { assertMonthlyGenerationsAllowed } from '@/lib/billing/usageLimits'
import {
  GENERATION_PROVIDER_API,
  GENERATION_PROVIDER_COMFY,
  GENERATION_WORKFLOW,
  getRequestId,
  logGenerationFailure,
} from '@/lib/logging/generationFailure'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const requestId = getRequestId(request)
  const userId = session.user.id

  const rule = RATE_LIMITS['/api/ai/generate-image']
  const rl = await checkRateLimit(`gen:${session.user.id}`, rule)
  if (!rl.ok) {
    return NextResponse.json(
      { detail: 'Rate limit exceeded', retryAfter: rl.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 })
  }

  const batchRaw = body.batch_size
  const batchSize =
    typeof batchRaw === 'number' && Number.isFinite(batchRaw) ? Math.floor(batchRaw) : 1

  const supabase = await createClient()
  const requestedOrg = body.org_id ?? body.orgId
  const resolved = await resolveGenerationOrgId(supabase, userId, requestedOrg)
  if (!resolved.ok) {
    return NextResponse.json({ detail: resolved.detail }, { status: 403 })
  }
  const orgId = resolved.orgId

  const planSlug = await getOrgPlanSlug(supabase, orgId)
  const plan = normalizePlan(planSlug)
  try {
    await assertMonthlyGenerationsAllowed(orgId, planSlug)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Usage limit'
    return NextResponse.json({ detail: msg }, { status: 403 })
  }
  const maxBatch = generationOutputLimitByPlan(plan)
  const requestedBatch = Math.max(1, Math.min(maxBatch, batchSize))
  const cost = requestedBatch

  if (!getGenerationQueue()) {
    logGenerationFailure({
      requestId,
      userId,
      resolvedOrgId: orgId,
      workflow: GENERATION_WORKFLOW,
      provider: GENERATION_PROVIDER_API,
      code: 'QUEUE_UNAVAILABLE',
      message: 'Generation queue not configured (REDIS_URL)',
    })
    return NextResponse.json(
      { detail: 'Generation queue unavailable (configure REDIS_URL)' },
      { status: 503 }
    )
  }

  const service = createServiceClient()
  const { data: orgRow, error: orgErr } = await service
    .from('organizations')
    .select('token_balance')
    .eq('id', orgId)
    .single()

  if (orgErr || orgRow == null) {
    logGenerationFailure({
      requestId,
      userId,
      resolvedOrgId: orgId,
      workflow: GENERATION_WORKFLOW,
      provider: GENERATION_PROVIDER_API,
      code: 'ORG_ROW_MISSING',
      message: orgErr?.message ?? 'Organization not found',
    })
    return NextResponse.json({ detail: 'Organization not found' }, { status: 404 })
  }

  const balance = typeof orgRow.token_balance === 'number' ? orgRow.token_balance : 0
  if (balance < cost) {
    return NextResponse.json({ detail: 'Insufficient tokens' }, { status: 402 })
  }

  const { error: deductErr } = await service
    .from('organizations')
    .update({ token_balance: balance - cost })
    .eq('id', orgId)

  if (deductErr) {
    logGenerationFailure({
      requestId,
      userId,
      resolvedOrgId: orgId,
      workflow: GENERATION_WORKFLOW,
      provider: GENERATION_PROVIDER_API,
      code: 'TOKEN_DEDUCT_FAILED',
      message: deductErr.message,
    })
    return NextResponse.json({ detail: 'Billing update failed' }, { status: 500 })
  }

  const inputParams = { ...stripGenerationRequestMeta(body), batch_size: requestedBatch }

  const { data: job, error: jobErr } = await supabase
    .from('generation_jobs')
    .insert({
      org_id: orgId,
      user_id: session.user.id,
      job_type: 'image',
      input_params: inputParams,
      status: 'queued',
    })
    .select('id')
    .single()

  if (jobErr || !job?.id) {
    await service
      .from('organizations')
      .update({ token_balance: balance })
      .eq('id', orgId)
    logGenerationFailure({
      requestId,
      userId,
      resolvedOrgId: orgId,
      workflow: GENERATION_WORKFLOW,
      provider: GENERATION_PROVIDER_API,
      code: 'JOB_CREATE_FAILED',
      message: jobErr?.message ?? 'No job id returned',
    })
    return NextResponse.json({ detail: 'Could not create job' }, { status: 500 })
  }

  try {
    await enqueueGenerationJob(job.id)
  } catch (e) {
    await service.from('organizations').update({ token_balance: balance }).eq('id', orgId)
    await service.from('generation_jobs').delete().eq('id', job.id)
    logGenerationFailure({
      requestId,
      userId,
      resolvedOrgId: orgId,
      jobId: job.id,
      workflow: GENERATION_WORKFLOW,
      provider: GENERATION_PROVIDER_COMFY,
      code: 'QUEUE_ENQUEUE_FAILED',
      message: e instanceof Error ? e.message : String(e),
    })
    return NextResponse.json({ detail: 'Queue error' }, { status: 503 })
  }

  return NextResponse.json({ jobId: job.id, id: job.id })
}
