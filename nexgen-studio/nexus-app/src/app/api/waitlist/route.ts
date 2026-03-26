import { NextResponse } from 'next/server'
import { parseWaitlistBody } from './waitlistBody'

/**
 * Public beta waitlist — no session required.
 * Persists to Supabase when configured; otherwise accepts and logs (dev-friendly).
 */
export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parseWaitlistBody(json)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid request'
    return NextResponse.json({ detail: message }, { status: 400 })
  }

  const { email, name, contentGoals, source } = parsed.data

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url && serviceKey) {
    try {
      const res = await fetch(`${url}/rest/v1/waitlist_signups`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          name: name || null,
          content_goals: contentGoals || null,
          source: source || 'landing_beta_invite',
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        // Unique violation → treat as success for UX
        if (res.status === 409 || /duplicate|unique|23505/i.test(text)) {
          return NextResponse.json({ ok: true, duplicate: true })
        }
        console.error('[waitlist] Supabase error', res.status, text)
        return NextResponse.json({ detail: 'Could not save signup. Try again later.' }, { status: 502 })
      }
    } catch (e) {
      console.error('[waitlist] Supabase request failed', e)
      return NextResponse.json({ detail: 'Could not save signup. Try again later.' }, { status: 502 })
    }
  } else {
    console.info('[waitlist] signup (no Supabase)', {
      email: email.toLowerCase(),
      name: name || undefined,
      source: source || 'landing_beta_invite',
    })
  }

  return NextResponse.json({ ok: true })
}
