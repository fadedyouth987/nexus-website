import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isPortfolioV2ServerEnabled } from '@/lib/core/featureFlags'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { resolveOrgContextForUser } from '@/lib/server/resolveOrgContext'

export async function GET(request: any) {
  if (!isPortfolioV2ServerEnabled()) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  }

  try {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
    })
    const userId = typeof token?.id === 'string' ? token.id : typeof token?.sub === 'string' ? token.sub : null
    if (!userId) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }

    const context = await resolveOrgContextForUser(userId)
    if (context.system === 'none' || !context.orgId) {
      return NextResponse.json(
        {
          detail: 'No organization found. Complete onboarding or run Supabase backfill (0003_backfill_v2) to provision org membership.',
        },
        { status: 404 }
      )
    }

    const requestedOrgId = new URL(request.url).searchParams.get('org_id')
    if (requestedOrgId && requestedOrgId !== context.orgId) {
      return NextResponse.json({ detail: 'Organization access denied' }, { status: 403 })
    }

    const admin = getEngineSupabaseAdmin()
    const { data, error } = await admin
      .from('organizations')
      .select('id, name')
      .eq('id', context.orgId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ detail: 'Failed to load organization' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ detail: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      role: context.role,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load organization'
    const detail =
      message.includes('relation') && message.includes('does not exist')
        ? 'Organization tables missing. Run Supabase migrations (e.g. 0003_v2_agency_tables).'
        : message

    return NextResponse.json({ detail }, { status: 500 })
  }
}
