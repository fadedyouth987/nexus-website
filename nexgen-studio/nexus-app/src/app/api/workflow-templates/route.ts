import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { canViewTemplate } from '@/lib/blueprint/entitlements'
import { getBlueprintSupabaseAdmin } from '@/lib/blueprint/supabaseAdmin'

export async function GET(request: Request) {
  try {
    const { profile } = await requireBlueprintUser(request)
    const admin = getBlueprintSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    let query = admin
      .from('workflow_templates')
      .select(
        'id, slug, name, type, content_policy, is_active, variables_json, ui_schema_json, comfy_workflow_json, base_cost_credits'
      )
      .order('name', { ascending: true })

    if (mode === 'IMAGE' || mode === 'VIDEO') {
      query = query.eq('type', mode)
    }

    if (!includeInactive) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ detail: 'Failed to load workflow templates' }, { status: 500 })
    }

    const items = (data ?? []).filter((template: any) =>
      canViewTemplate(profile, {
        is_active: Boolean(template.is_active),
        content_policy:
          typeof template.content_policy === 'string' ? template.content_policy : 'SFW',
      })
    )

    return NextResponse.json({ items })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load workflow templates' },
      { status }
    )
  }
}
