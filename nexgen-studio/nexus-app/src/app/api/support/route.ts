import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string
      subject?: string
      category?: string
      message?: string
      path?: string
      severity?: 'low' | 'normal' | 'high' | 'urgent'
    }

    const email = String(body.email || '').trim().toLowerCase()
    const subject = String(body.subject || '').trim()
    const category = String(body.category || 'general').trim().toLowerCase()
    const message = String(body.message || '').trim()
    const path = String(body.path || '').trim()
    const severity = (body.severity || 'normal') as 'low' | 'normal' | 'high' | 'urgent'

    if (!email || !email.includes('@')) {
      return NextResponse.json({ detail: 'Valid email is required' }, { status: 400 })
    }
    if (!subject) {
      return NextResponse.json({ detail: 'Subject is required' }, { status: 400 })
    }
    if (!message || message.length < 10) {
      return NextResponse.json({ detail: 'Message must be at least 10 characters' }, { status: 400 })
    }

    const token = await getToken({
      req: request as any,
      secret: process.env.NEXTAUTH_SECRET,
    })
    const userId = typeof token?.sub === 'string' ? token.sub : null

    const admin = getEngineSupabaseAdmin()
    const { data, error } = await admin
      .from('support_tickets')
      .insert({
        user_id: userId,
        email,
        subject,
        category,
        message,
        path: path || null,
        severity,
        status: 'open',
      })
      .select('id')
      .single()

    if (error || !data?.id) {
      return NextResponse.json({ detail: error?.message || 'Failed to submit support request' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, ticketId: data.id }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to submit support request' },
      { status: 500 }
    )
  }
}

