import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { AgencyDashboardClient } from '@/components/agency/AgencyDashboardClient'
import type {
  CreatorMetricsRow,
  PerformancePoint,
  WorkspaceMetricsRow,
  WorkspaceRow,
} from '@/components/agency/types'

async function safeSelect<T>(query: any) {
  const { data } = await query
  return (data || []) as T[]
}

export default async function AgencyPage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const workspaces = await safeSelect<WorkspaceRow>(
    supabase.from('workspaces_v2').select('id, name').order('created_at', { ascending: true })
  )

  const workspaceMetrics = await safeSelect<WorkspaceMetricsRow>(
    supabase.from('v_agency_workspace_metrics').select('*')
  )

  const creatorMetrics = await safeSelect<CreatorMetricsRow>(
    supabase.from('v_agency_creator_metrics').select('*')
  )

  const performancePoints = await safeSelect<PerformancePoint>(
    supabase.from('v_agency_performance_timeseries').select('*').order('day', { ascending: true })
  )

  return (
    <AgencyDashboardClient
      workspaces={workspaces}
      workspaceMetrics={workspaceMetrics}
      creatorMetrics={creatorMetrics}
      performancePoints={performancePoints}
    />
  )
}
