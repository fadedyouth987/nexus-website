import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { runInfluencerFactory } from '@/lib/automation/orchestrators/influencerFactory'
import type { FactoryPayload } from '@/lib/automation/pipeline/types'

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    const body = (await request.json().catch(() => ({}))) as FactoryPayload
    const result = await runInfluencerFactory(authUserId, body)

    return NextResponse.json(result)
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Factory run failed' },
      { status }
    )
  }
}
