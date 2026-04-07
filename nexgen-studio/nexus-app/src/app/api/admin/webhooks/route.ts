import { NextResponse } from 'next/server'
import { requireAppSession, requireAdminRole } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/webhooks - List configured webhooks
 */
export async function GET() {
  const session = await requireAppSession()
  await requireAdminRole(session)

  const admin = getSupabaseAdmin()

  const { data, error } = await admin
    .from('organization_webhooks')
    .select('id, url, events, is_active, created_at, updated_at, secret_key')
    .eq('organization_id', session.orgId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 500 })
  }

  // Mask secret keys in response
  const masked = data?.map((wh) => ({
    ...wh,
    secret_key: wh.secret_key ? '****' + wh.secret_key.slice(-4) : null,
  }))

  return NextResponse.json({ webhooks: masked || [] })
}

/**
 * POST /api/admin/webhooks - Create or update webhook
 */
export async function POST(request: Request) {
  const session = await requireAppSession()
  await requireAdminRole(session)

  const body = await request.json()
  const { id, url, events, is_active } = body

  // Validation
  if (!url || !events || !Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ detail: 'URL and events array required' }, { status: 400 })
  }

  // Validate URL
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ detail: 'Invalid URL' }, { status: 400 })
  }

  // Validate events
  const validEvents = [
    'generation.queued',
    'generation.generating',
    'generation.ready',
    'generation.failed',
    'generation.cancelled',
    'job.completed',
    'job.failed',
  ]
  const invalidEvents = events.filter((e) => !validEvents.includes(e))
  if (invalidEvents.length > 0) {
    return NextResponse.json(
      { detail: `Invalid events: ${invalidEvents.join(', ')}` },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()

  // Generate secret for new webhooks
  const secretKey = crypto.randomBytes(32).toString('hex')

  if (id) {
    // Update existing
    const { data, error } = await admin
      .from('organization_webhooks')
      .update({ url, events, is_active: is_active ?? true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', session.orgId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ webhook: data })
  }

  // Create new
  const { data, error } = await admin
    .from('organization_webhooks')
    .insert({
      organization_id: session.orgId,
      url,
      events,
      is_active: is_active ?? true,
      secret_key: secretKey,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 500 })
  }

  // Return secret key only on creation
  return NextResponse.json({
    webhook: { ...data, secret_key_display: secretKey.slice(0, 8) + '...' },
    warning: 'Save this secret - it will not be shown again',
  })
}

/**
 * DELETE /api/admin/webhooks - Delete webhook
 */
export async function DELETE(request: Request) {
  const session = await requireAppSession()
  await requireAdminRole(session)

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json({ detail: 'Webhook ID required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { error } = await admin
    .from('organization_webhooks')
    .delete()
    .eq('id', id)
    .eq('organization_id', session.orgId)

  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
