import { NextResponse } from 'next/server'
import { isPortfolioV2ServerEnabled } from '@/lib/core/featureFlags'
import {
  AccessError,
  getServerSupabase,
  getServerUser,
  requireOrgMembership,
  requireWorkspaceAccess,
} from '@/lib/server/v2Access'

function normalizeDate(value: string | null, fallback: Date) {
  if (!value) return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed
}

export async function GET(request: Request) {
  if (!isPortfolioV2ServerEnabled()) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  }

  try {
    const supabase = await getServerSupabase(request)
    const user = await getServerUser(request)
    const { searchParams } = new URL(request.url)
    const org = await requireOrgMembership(request, {
      supabase,
      user,
      orgId: searchParams.get('org_id'),
    })
    const workspace = await requireWorkspaceAccess(request, {
      supabase,
      user,
      orgId: org.orgId,
      workspaceId: searchParams.get('workspace_id'),
    })

    const now = new Date()
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const from = normalizeDate(searchParams.get('from'), defaultFrom).toISOString()
    const to = normalizeDate(searchParams.get('to'), now).toISOString()

    const [
      creatorsCountResult,
      contentCountResult,
      scheduleCountResult,
      performanceRowsResult,
      contentRowsResult,
      creatorsRowsResult,
    ] = await Promise.all([
      supabase
        .from('creators_v2')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId),
      supabase
        .from('content_v2')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId),
      supabase
        .from('schedules_v2')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId),
      supabase
        .from('performance_v2')
        .select('content_id, platform, views, engagement, revenue, recorded_at')
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId)
        .gte('recorded_at', from)
        .lte('recorded_at', to)
        .order('recorded_at', { ascending: false }),
      supabase
        .from('content_v2')
        .select('id, creator_id')
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId),
      supabase
        .from('creators_v2')
        .select('id, name')
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId),
    ])

    const queryErrors = [
      creatorsCountResult.error,
      contentCountResult.error,
      scheduleCountResult.error,
      performanceRowsResult.error,
      contentRowsResult.error,
      creatorsRowsResult.error,
    ].filter(Boolean)

    if (queryErrors.length > 0) {
      throw new AccessError(500, 'Failed to load analytics')
    }

    const contentRows = contentRowsResult.data ?? []
    const creatorByContentId = new Map(contentRows.map((row) => [row.id, row.creator_id]))
    const creatorNameById = new Map((creatorsRowsResult.data ?? []).map((row) => [row.id, row.name]))
    const performanceRows = performanceRowsResult.data ?? []

    const creatorTotals = new Map<string, { views: number; engagement: number; revenue: number }>()
    const platformTotals = new Map<string, { views: number; engagement: number; revenue: number }>()
    const dailyTotals = new Map<string, { views: number; engagement: number; revenue: number }>()

    const totals = { views: 0, engagement: 0, revenue: 0 }

    for (const row of performanceRows) {
      const views = row.views || 0
      const engagement = row.engagement || 0
      const revenue = Number(row.revenue || 0)
      totals.views += views
      totals.engagement += engagement
      totals.revenue += revenue

      const creatorId = creatorByContentId.get(row.content_id) || 'unknown'
      const creatorAgg = creatorTotals.get(creatorId) || { views: 0, engagement: 0, revenue: 0 }
      creatorAgg.views += views
      creatorAgg.engagement += engagement
      creatorAgg.revenue += revenue
      creatorTotals.set(creatorId, creatorAgg)

      const platform = row.platform || 'unknown'
      const platformAgg = platformTotals.get(platform) || { views: 0, engagement: 0, revenue: 0 }
      platformAgg.views += views
      platformAgg.engagement += engagement
      platformAgg.revenue += revenue
      platformTotals.set(platform, platformAgg)

      const day = new Date(row.recorded_at).toISOString().slice(0, 10)
      const dailyAgg = dailyTotals.get(day) || { views: 0, engagement: 0, revenue: 0 }
      dailyAgg.views += views
      dailyAgg.engagement += engagement
      dailyAgg.revenue += revenue
      dailyTotals.set(day, dailyAgg)
    }

    return NextResponse.json({
      metrics: {
        creators: creatorsCountResult.count ?? 0,
        content: contentCountResult.count ?? 0,
        schedules: scheduleCountResult.count ?? 0,
        views: totals.views,
        engagement: totals.engagement,
        revenue: totals.revenue,
      },
      breakdowns: {
        by_creator: Array.from(creatorTotals.entries())
          .map(([creator_id, values]) => ({
            creator_id,
            creator_name: creatorNameById.get(creator_id) || 'Unknown creator',
            ...values,
          }))
          .sort((a, b) => b.views - a.views),
        by_platform: Array.from(platformTotals.entries())
          .map(([platform, values]) => ({
            platform,
            ...values,
          }))
          .sort((a, b) => b.views - a.views),
        by_day: Array.from(dailyTotals.entries())
          .map(([day, values]) => ({
            day,
            ...values,
          }))
          .sort((a, b) => (a.day < b.day ? -1 : 1)),
      },
      meta: {
        org_id: org.orgId,
        workspace_id: workspace.workspaceId,
        workspace_name: workspace.workspaceName,
        role: workspace.role,
        from,
        to,
      },
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load analytics' },
      { status }
    )
  }
}
