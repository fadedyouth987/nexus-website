import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import Stripe from 'stripe'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

const stripeKey = process.env.STRIPE_SECRET_KEY || ''
const stripe = stripeKey ? new Stripe(stripeKey) : null
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

async function readOrgId(request: Request) {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const body = await request.json()
      if (body && typeof body === 'object' && !Array.isArray(body) && typeof body.orgId === 'string') {
        return body.orgId.trim()
      }
    } catch {
      return ''
    }
    return ''
  }

  try {
    const form = await request.formData()
    const raw = form.get('orgId')
    return typeof raw === 'string' ? raw.trim() : ''
  } catch {
    return ''
  }
}

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ detail: 'Stripe is not configured' }, { status: 500 })
  }

  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const userId = token.sub
  const orgId = await readOrgId(request)
  if (!orgId) {
    return NextResponse.json({ detail: 'Missing orgId' }, { status: 400 })
  }

  const admin = getEngineSupabaseAdmin()

  const { data: membership, error: membershipError } = await admin
    .from('organization_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .in('role', ['owner', 'admin'])
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    return NextResponse.json({ detail: membershipError.message || 'Failed to verify organization access' }, { status: 500 })
  }

  if (!membership) {
    return NextResponse.json({ detail: 'Forbidden' }, { status: 403 })
  }

  const { data: organization, error: orgError } = await admin
    .from('organizations')
    .select('id, name, stripe_customer_id')
    .eq('id', orgId)
    .maybeSingle()

  if (orgError) {
    return NextResponse.json({ detail: orgError.message || 'Failed to load organization' }, { status: 500 })
  }
  if (!organization) {
    return NextResponse.json({ detail: 'Organization not found' }, { status: 404 })
  }

  if (typeof organization.stripe_customer_id === 'string' && organization.stripe_customer_id.startsWith('cus_')) {
    return NextResponse.redirect(new URL(`/organizations/${orgId}/billing?connected=1`, siteUrl), { status: 303 })
  }

  try {
    const customer = await stripe.customers.create({
      name: typeof organization.name === 'string' ? organization.name : undefined,
      metadata: { orgId },
    })

    const { error: updateError } = await admin
      .from('organizations')
      .update({ stripe_customer_id: customer.id })
      .eq('id', orgId)

    if (updateError) {
      return NextResponse.json({ detail: updateError.message || 'Failed to save Stripe customer' }, { status: 500 })
    }

    return NextResponse.redirect(new URL(`/organizations/${orgId}/billing?connected=1`, siteUrl), { status: 303 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to connect Stripe'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
