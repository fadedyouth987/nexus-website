import { NextResponse } from 'next/server'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { checkRateLimit, getIdentifier } from '@/lib/core/rateLimit'

type WaitlistBody = {
  email?: string
  name?: string
  contentGoals?: string
  source?: string
}

function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().slice(0, maxLength)
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(request: Request) {
  const { ok } = checkRateLimit(getIdentifier(request))
  if (!ok) {
    return NextResponse.json({ detail: 'Too many requests' }, { status: 429 })
  }

  let body: WaitlistBody
  try {
    const parsed = await request.json()
    body =
      parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as WaitlistBody)
        : {}
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
  }

  const email = normalizeText(body.email, 320).toLowerCase()
  const name = normalizeText(body.name, 120)
  const contentGoals = normalizeText(body.contentGoals, 4000)
  const source = normalizeText(body.source, 120) || 'landing'

  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ detail: 'Valid email is required' }, { status: 400 })
  }

  const admin = getEngineSupabaseAdmin()

  const { data: lead, error: leadError } = await admin
    .from('waitlist_leads')
    .upsert(
      {
        email,
        name: name || null,
        content_goals: contentGoals || null,
        source,
        status: 'waitlist',
        metadata_json: {
          source,
          referer: request.headers.get('referer') || null,
        },
      },
      {
        onConflict: 'email',
        ignoreDuplicates: false,
      }
    )
    .select('id')
    .single()

  if (leadError || !lead?.id) {
    return NextResponse.json({ detail: leadError?.message || 'Failed to save waitlist entry' }, { status: 500 })
  }

  await admin.from('mvp_events').insert({
    event_name: 'waitlist_submitted',
    lead_id: lead.id,
    path: '/landing',
    user_agent: request.headers.get('user-agent') || null,
    metadata_json: {
      source,
      has_name: Boolean(name),
      has_content_goals: Boolean(contentGoals),
    },
  })

  return NextResponse.json({ ok: true })
}
