import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { createBlueprintGenerationJob } from '@/lib/blueprint/createJob'
import { checkRateLimit, getIdentifier } from '@/lib/core/rateLimit'

export async function POST(request: Request) {
  try {
    const { authUserId, profile } = await requireBlueprintUser(request)

    const { ok, remaining } = checkRateLimit(getIdentifier(request, authUserId))
    if (!ok) {
      return NextResponse.json(
        { detail: 'Too many generation requests. Try again later.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const influencerId =
      typeof body.influencerId === 'string' ? body.influencerId : ''
    const workflowTemplateId =
      typeof body.workflowTemplateId === 'string' ? body.workflowTemplateId : ''
    const mode = body.mode === 'VIDEO' ? 'VIDEO' : body.mode === 'IMAGE' ? 'IMAGE' : null
    const inputs =
      body.inputs && typeof body.inputs === 'object'
        ? (body.inputs as Record<string, unknown>)
        : null

    if (!influencerId || !workflowTemplateId || !mode || !inputs) {
      return NextResponse.json(
        { detail: 'influencerId, workflowTemplateId, mode, and inputs are required' },
        { status: 400 }
      )
    }

    const job = await createBlueprintGenerationJob({
      userId: authUserId,
      profile,
      influencerId,
      workflowTemplateId,
      mode,
      inputs,
    })

    return NextResponse.json(
      { jobId: job.id },
      { status: 201, headers: { 'X-RateLimit-Remaining': String(remaining) } }
    )
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500
    const typedError = error as {
      code?: string
      plan?: string
      batchLimit?: number
    }
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : 'Failed to create generation job',
        code: typedError.code,
        plan: typedError.plan,
        batchLimit: typedError.batchLimit,
      },
      { status }
    )
  }
}
