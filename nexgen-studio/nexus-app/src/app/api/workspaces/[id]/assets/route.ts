import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { createClient } from '@/lib/supabase/server'
import { listAssetsForTab } from '@/lib/blueprint/readModel'

async function getUserId(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })
  return typeof token?.id === 'string' ? token.id : null
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const url = new URL(request.url)
  const visibility = url.searchParams.get('visibility') === 'VAULT' ? 'VAULT' : 'STANDARD'
  const influencerId = url.searchParams.get('influencerId')?.trim() || undefined
  const supabase = await createClient()
  const { data: member } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ detail: 'Workspace not found' }, { status: 404 })
  }

  let assets
  try {
    assets = await listAssetsForTab({
      supabase,
      userId,
      orgId: id,
      visibility,
      influencerId,
    })
  } catch {
    return NextResponse.json({ detail: 'Failed to load assets' }, { status: 500 })
  }

  return NextResponse.json(assets)
}
