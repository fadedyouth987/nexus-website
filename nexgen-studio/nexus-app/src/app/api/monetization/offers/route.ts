import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { resolveOrgContextForUser } from '@/lib/server/resolveOrgContext'

type OfferStatus = 'draft' | 'active' | 'paused' | 'archived'

export async function GET(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = getEngineSupabaseAdmin()
    const context = await resolveOrgContextForUser(token.sub)

    let query = admin
      .from('monetization_offers')
      .select('id, name, offer_type, content_rating, platform, price_cents, currency, status, created_at, updated_at')
      .eq('user_id', token.sub)
      .order('updated_at', { ascending: false })

    if (context.orgId) {
      query = query.or(`org_id.eq.${context.orgId},org_id.is.null`)
    } else {
      query = query.is('org_id', null)
    }

    const { data, error } = await query.limit(100)
    if (error) {
      if (error.message.includes('relation') && error.message.includes('does not exist')) {
        return NextResponse.json({ mode: context.orgId ? 'organization' : 'solo', offers: [] })
      }
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    return NextResponse.json({
      mode: context.orgId ? 'organization' : 'solo',
      offers: (data ?? []).map((row: any) => ({
        id: String(row.id),
        name: String(row.name),
        offerType: String(row.offer_type),
        contentRating: String(row.content_rating),
        platform: row.platform ? String(row.platform) : null,
        priceCents: Number(row.price_cents || 0),
        currency: String(row.currency || 'usd'),
        status: String(row.status || 'draft'),
        createdAt: row.created_at ? String(row.created_at) : null,
        updatedAt: row.updated_at ? String(row.updated_at) : null,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load offers' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const context = await resolveOrgContextForUser(token.sub)
    const body = (await request.json().catch(() => ({}))) as {
      name?: string
      offerType?: string
      contentRating?: 'sfw' | 'nsfw'
      platform?: string | null
      priceCents?: number
      currency?: string
      status?: OfferStatus
    }

    const name = String(body.name || '').trim()
    const offerType = String(body.offerType || 'paid_shoutout').trim()
    const contentRating = body.contentRating === 'nsfw' ? 'nsfw' : 'sfw'
    const platform = body.platform ? String(body.platform).trim() : null
    const priceCents = Number(body.priceCents || 0)
    const currency = String(body.currency || 'usd').toLowerCase()
    const status = (body.status || 'draft') as OfferStatus

    if (!name) return NextResponse.json({ detail: 'name is required' }, { status: 400 })
    if (!offerType) return NextResponse.json({ detail: 'offerType is required' }, { status: 400 })
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return NextResponse.json({ detail: 'priceCents must be >= 0' }, { status: 400 })
    }

    const admin = getEngineSupabaseAdmin()
    const { data, error } = await admin
      .from('monetization_offers')
      .insert({
        user_id: token.sub,
        org_id: context.orgId,
        name,
        offer_type: offerType,
        content_rating: contentRating,
        platform,
        price_cents: Math.round(priceCents),
        currency,
        status,
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to create offer' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      id?: string
      status?: OfferStatus
    }
    const id = String(body.id || '').trim()
    const status = (body.status || '').trim() as OfferStatus
    if (!id) return NextResponse.json({ detail: 'id is required' }, { status: 400 })
    if (!['draft', 'active', 'paused', 'archived'].includes(status)) {
      return NextResponse.json({ detail: 'Invalid status' }, { status: 400 })
    }

    const admin = getEngineSupabaseAdmin()
    const { error } = await admin
      .from('monetization_offers')
      .update({ status })
      .eq('id', id)
      .eq('user_id', token.sub)

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to update offer' },
      { status: 500 }
    )
  }
}

