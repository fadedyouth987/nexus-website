import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { runPipeline } from '@/lib/automation/pipeline/runner'
import { generateStrategyStep } from '@/lib/automation/pipeline/steps/generateStrategy'
import { createInfluencerPipelineContext } from '@/lib/automation/orchestrators/influencerFactory'

type GenerateStrategyPayload = {
  planId?: string
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    const body = (await request.json().catch(() => ({}))) as GenerateStrategyPayload
    const planId = String(body.planId || '').trim()

    if (!planId) {
      return NextResponse.json({ detail: 'planId is required' }, { status: 400 })
    }

    const result = await runPipeline(
      [generateStrategyStep()],
      createInfluencerPipelineContext(authUserId, {}, { planId })
    )

    return NextResponse.json({
      ok: true,
      planId,
      strategy: result.context.strategy,
      reports: result.reports.map((report) => ({ name: report.name, status: report.status })),
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Generate strategy step failed' },
      { status }
    )
  }
}
