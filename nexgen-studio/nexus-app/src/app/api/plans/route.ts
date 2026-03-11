import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { createPlan } from '@/lib/planner/actions'

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    let body: { name?: string; timezone?: string } = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 })
    }
    const { planId } = await createPlan(authUserId, {
      name: typeof body.name === 'string' ? body.name.trim() || undefined : undefined,
      timezone: typeof body.timezone === 'string' ? body.timezone.trim() || undefined : undefined,
    })
    return NextResponse.json({ planId })
  } catch (err: unknown) {
    const status = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 500
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Failed to create plan' },
      { status }
    )
  }
}
