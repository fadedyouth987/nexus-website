import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { runPipeline } from '@/lib/automation/pipeline/runner'
import { createCreatorStep } from '@/lib/automation/pipeline/steps/createCreator'
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
      [createCreatorStep()],
      createInfluencerPipelineContext(authUserId, persona)
    )

    return NextResponse.json({
      ok: true,
      creator: result.context.creator,
      reports: result.reports.map((report) => ({ name: report.name, status: report.status })),
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Create creator step failed' },
      { status }
    )
  }
}
