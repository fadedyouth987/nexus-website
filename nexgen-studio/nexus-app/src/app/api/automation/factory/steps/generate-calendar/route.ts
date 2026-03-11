import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { runPipeline } from '@/lib/automation/pipeline/runner'
import { generateCalendarStep } from '@/lib/automation/pipeline/steps/generateCalendar'
import { createInfluencerPipelineContext } from '@/lib/automation/orchestrators/influencerFactory'

type GenerateCalendarPayload = {
  planId?: string
  durationDays?: number
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    const body = (await request.json().catch(() => ({}))) as GenerateCalendarPayload
    const planId = String(body.planId || '').trim()
    const durationDays =
      typeof body.durationDays === 'number' && Number.isFinite(body.durationDays)
        ? Math.max(1, Math.floor(body.durationDays))
        : 30

    if (!planId) {
      return NextResponse.json({ detail: 'planId is required' }, { status: 400 })
    }

    const result = await runPipeline(
      [generateCalendarStep(durationDays)],
      createInfluencerPipelineContext(authUserId, {}, { planId })
    )

    return NextResponse.json({
      ok: true,
      planId,
      contentItems: result.context.contentItems,
      contentItemsCount: result.context.contentItems.length,
      reports: result.reports.map((report) => ({ name: report.name, status: report.status })),
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Generate calendar step failed' },
      { status }
    )
  }
}
