import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { runPipeline } from '@/lib/automation/pipeline/runner'
import { createPlanStep } from '@/lib/automation/pipeline/steps/createPlan'
import type { FactoryPayload } from '@/lib/automation/pipeline/types'
import {
  assertFactoryPersona,
  createInfluencerPipelineContext,
} from '@/lib/automation/orchestrators/influencerFactory'

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    const body = (await request.json().catch(() => ({}))) as FactoryPayload
    const persona = assertFactoryPersona(body)
    const result = await runPipeline(
      [createPlanStep()],
      createInfluencerPipelineContext(authUserId, persona)
    )

    return NextResponse.json({
      ok: true,
      planId: result.context.planId,
      reports: result.reports.map((report) => ({ name: report.name, status: report.status })),
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Create plan step failed' },
      { status }
    )
  }
}
