import { NextResponse } from 'next/server'
import { getServerSupabase, requireUser } from '@/lib/server/v2Access'
import {
  ENGINE_MODEL_QUEUE,
  ENGINE_MODEL_VALIDATION_JOB,
  enqueueEngineJob,
} from '@/lib/engine/queue'
import { reserveCredits } from '@/lib/billing/credits'
import { estimateModelValidationTokens } from '@/lib/billing/tokenCosts'

type EnqueueBody = {
  model_id?: string
  expected_runtime_seconds?: number
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    const supabase = await getServerSupabase(request)

    let body: EnqueueBody = {}
    try {
      body = (await request.json()) as EnqueueBody
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const modelId = typeof body.model_id === 'string' ? body.model_id.trim() : ''
    if (!modelId) {
      return NextResponse.json({ detail: 'model_id is required' }, { status: 400 })
    }

    const expectedRuntimeSeconds = Number(body.expected_runtime_seconds || 600)
    const tokensToReserve = estimateModelValidationTokens(
      Number.isFinite(expectedRuntimeSeconds) ? Math.max(1, Math.floor(expectedRuntimeSeconds)) : 600
    )

    const { data: model, error: modelError } = await supabase
      .from('models')
      .select('id, user_id')
      .eq('id', modelId)
      .maybeSingle()

    if (modelError) {
      return NextResponse.json({ detail: modelError.message || 'Failed to load model' }, { status: 500 })
    }
    if (!model) {
      return NextResponse.json({ detail: 'Model not found' }, { status: 404 })
    }

    const reserve = await reserveCredits({
      userId: user.userId,
      credits: tokensToReserve,
      refType: 'MODEL_GPU_JOB',
      refId: modelId,
    })
    if (!reserve.ok) {
      const status = reserve.code === 'INSUFFICIENT_CREDITS' ? 402 : 500
      return NextResponse.json(
        {
          detail: reserve.message,
          code: reserve.code,
        },
        { status }
      )
    }

    const { data: gpuJob, error: gpuJobError } = await supabase
      .from('model_gpu_jobs')
      .insert({
        user_id: user.userId,
        model_id: modelId,
        status: 'QUEUED',
        reserved_credits: reserve.reservedCredits,
        metadata_json: {
          expected_runtime_seconds: expectedRuntimeSeconds,
        },
      })
      .select('id, model_id, status, reserved_credits, created_at')
      .single()

    if (gpuJobError || !gpuJob) {
      return NextResponse.json(
        { detail: gpuJobError?.message || 'Failed to create GPU job row' },
        { status: 500 }
      )
    }

    const queueJobId = await enqueueEngineJob({
      queueName: ENGINE_MODEL_QUEUE,
      jobName: ENGINE_MODEL_VALIDATION_JOB,
      payload: {
        kind: 'model_validation',
        modelId,
        reservedCredits: reserve.reservedCredits,
      },
    })

    await supabase
      .from('model_gpu_jobs')
      .update({
        queue_job_id: queueJobId,
      })
      .eq('id', gpuJob.id)

    return NextResponse.json(
      {
        job: {
          ...gpuJob,
          queue_job_id: queueJobId,
        },
        reserved_credits: reserve.reservedCredits,
        reserved_tokens: reserve.reservedCredits,
        estimated_runtime_seconds: expectedRuntimeSeconds,
      },
      { status: 201 }
    )
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to enqueue model GPU job' },
      { status }
    )
  }
}
