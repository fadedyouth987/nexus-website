import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

type FeedbackBody = {
  planId?: string
  rating?: number
  message?: string
  action?: 'feedback_submitted' | 'export_clicked' | 'share_clicked'
  path?: string
  context?: string
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().slice(0, maxLength)
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    let body: FeedbackBody

    try {
      const parsed = await request.json()
      body =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as FeedbackBody)
          : {}
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const action = body.action || 'feedback_submitted'
    const planId = normalizeText(body.planId, 120) || null
    const message = normalizeText(body.message, 4000)
    const path = normalizeText(body.path, 400) || null
    const context = normalizeText(body.context, 200) || null
    const rating =
      typeof body.rating === 'number' && Number.isFinite(body.rating)
        ? Math.max(1, Math.min(5, Math.floor(body.rating)))
        : null

    if (action === 'feedback_submitted' && !message && rating == null) {
      return NextResponse.json(
        { detail: 'message or rating is required for feedback' },
        { status: 400 }
      )
    }

    const admin = getEngineSupabaseAdmin()
    const { error } = await admin.from('mvp_events').insert({
      event_name: action,
      user_id: authUserId,
      plan_id: planId,
      path: path || '/plan',
      user_agent: request.headers.get('user-agent') || null,
      metadata_json: {
        message: message || null,
        rating,
        context,
      },
    })

    if (error) {
      return NextResponse.json({ detail: error.message || 'Failed to save feedback' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to capture feedback event' },
      { status }
    )
  }
}
