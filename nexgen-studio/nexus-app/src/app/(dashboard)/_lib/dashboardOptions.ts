import { getSupabaseAdmin } from '@/server/supabase/admin'
import type { AppSession } from '@/server/auth/session'
import { isMissingRelationError } from '@/server/supabase/errors'

export type DashboardOption = {
  value: string
  label: string
}

export async function getDashboardFormOptions(session: AppSession) {
  const admin = getSupabaseAdmin()

  const [projects, brandKits, campaigns, influencers, workflowTemplates] = await Promise.all([
    admin.from('projects').select('id, name').eq('org_id', session.orgId).order('name', { ascending: true }),
    admin.from('brand_kits').select('id, name').eq('org_id', session.orgId).order('name', { ascending: true }),
    admin.from('campaigns').select('id, name').eq('org_id', session.orgId).order('updated_at', { ascending: false }),
    admin.from('influencers').select('id, name').eq('org_id', session.orgId).order('name', { ascending: true }),
    admin
      .from('workflow_templates')
      .select('id, name, slug, type, is_active')
      .eq('is_active', true)
      .order('name', { ascending: true }),
  ])

  return {
    projects: isMissingRelationError(projects.error) ? [] : (projects.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    brandKits: isMissingRelationError(brandKits.error) ? [] : (brandKits.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    campaigns: isMissingRelationError(campaigns.error) ? [] : (campaigns.data ?? []).map((item) => ({ value: item.id, label: item.name })),
    influencers: (influencers.data ?? []).map((item) => ({ value: item.id, label: item.name || item.id })),
    workflowTemplates: (workflowTemplates.data ?? []).map((item) => ({
      value: item.id,
      label: `${item.name || item.slug} (${item.type})`,
    })),
  }
}
