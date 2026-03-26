import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { createClient } from '@/lib/supabase/server'
import { getPrimaryOrgId } from '@/lib/api/org'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: Ctx) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const supabase = await createClient()
  const orgId = await getPrimaryOrgId(supabase, session.user.id)
  if (!orgId) {
    return NextResponse.json({ error: 'No organization' }, { status: 404 })
  }

  const { data: row, error: fetchError } = await supabase
    .from('generated_assets')
    .select('id, is_favorite')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: updated, error: updateError } = await supabase
    .from('generated_assets')
    .update({ is_favorite: !row.is_favorite })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
