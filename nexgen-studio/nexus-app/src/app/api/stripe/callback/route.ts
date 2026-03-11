import { NextResponse } from 'next/server'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const orgId = searchParams.get('orgId')
  const target = orgId ? `/organizations/${orgId}/billing` : '/settings/billing'
  return NextResponse.redirect(new URL(target, siteUrl))
}
