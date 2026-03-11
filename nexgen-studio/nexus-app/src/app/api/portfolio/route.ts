import { NextResponse } from 'next/server'
import { isPortfolioV2ServerEnabled } from '@/lib/core/featureFlags'
import {
  AccessError,
  getServerSupabase,
  getServerUser,
  requireOrgMembership,
  requireWorkspaceAccess,
} from '@/lib/server/v2Access'

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

    const [
      creatorsCountResult,
      contentCountResult,
      scheduleCountResult,
      contentRowsResult,
      creatorsRowsResult,
      publishedContentResult,
      upcomingSchedulesResult,
      performanceResult,
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
        .from('content_v2')
        .select('id, creator_id')
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId),
      supabase
        .from('creators_v2')
        .select('id, name')
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId),
      supabase
        .from('content_v2')
        .select('id, type, status, created_at')
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('schedules_v2')
        .select('id, content_id, platform, scheduled_for, status')
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId)
        .in('status', ['queued', 'scheduled'])
        .order('scheduled_for', { ascending: true, nullsFirst: false })
        .limit(5),
      supabase
        .from('performance_v2')
        .select('content_id, platform, views, engagement, revenue, recorded_at')
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId),
    ])

    const queryErrors = [
      creatorsCountResult.error,
      contentCountResult.error,
      scheduleCountResult.error,
      contentRowsResult.error,
      creatorsRowsResult.error,
      publishedContentResult.error,
      upcomingSchedulesResult.error,
      performanceResult.error,
    ].filter(Boolean)

    if (queryErrors.length > 0) {
      throw new AccessError(500, 'Failed to load portfolio metrics')
    }

    const contentRows = contentRowsResult.data ?? []
    const creatorByContentId = new Map(contentRows.map((row) => [row.id, row.creator_id]))
    const creatorNameById = new Map((creatorsRowsResult.data ?? []).map((row) => [row.id, row.name]))

    const performanceRows = performanceResult.data ?? []
    const latestByContentId = new Map<string, (typeof performanceRows)[number]>()
    for (const row of performanceRows) {
      const existing = latestByContentId.get(row.content_id)
      if (!existing || new Date(row.recorded_at).getTime() > new Date(existing.recorded_at).getTime()) {
        latestByContentId.set(row.content_id, row)
      }
    }

    const creatorTotals = new Map<string, { views: number; engagement: number; revenue: number }>()
    const platformTotals = new Map<string, { views: number; engagement: number; revenue: number }>()
    const dailyTotals = new Map<string, { views: number; engagement: number; revenue: number }>()

    const latestPerformanceRows = Array.from(latestByContentId.values())
    const performanceTotals = latestPerformanceRows.reduce(
      (totals, row) => ({
        views: totals.views + (row.views || 0),
        engagement: totals.engagement + (row.engagement || 0),
        revenue: totals.revenue + Number(row.revenue || 0),
      }),
      { views: 0, engagement: 0, revenue: 0 }
    )

    for (const row of latestPerformanceRows) {
      const creatorId = creatorByContentId.get(row.content_id) || 'unknown'
      const platform = row.platform || 'unknown'
      const day = new Date(row.recorded_at).toISOString().slice(0, 10)

      const creatorAgg = creatorTotals.get(creatorId) || { views: 0, engagement: 0, revenue: 0 }
      creatorAgg.views += row.views || 0
      creatorAgg.engagement += row.engagement || 0
      creatorAgg.revenue += Number(row.revenue || 0)
      creatorTotals.set(creatorId, creatorAgg)

      const platformAgg = platformTotals.get(platform) || { views: 0, engagement: 0, revenue: 0 }
      platformAgg.views += row.views || 0
      platformAgg.engagement += row.engagement || 0
      platformAgg.revenue += Number(row.revenue || 0)
      platformTotals.set(platform, platformAgg)

      const dailyAgg = dailyTotals.get(day) || { views: 0, engagement: 0, revenue: 0 }
      dailyAgg.views += row.views || 0
      dailyAgg.engagement += row.engagement || 0
      dailyAgg.revenue += Number(row.revenue || 0)
      dailyTotals.set(day, dailyAgg)
    }

    return NextResponse.json({
      metrics: {
        creators: creatorsCountResult.count ?? 0,
        content: contentCountResult.count ?? 0,
        schedules: scheduleCountResult.count ?? 0,
        views: performanceTotals.views,
        engagement: performanceTotals.engagement,
        revenue: performanceTotals.revenue,
      },
      analytics: {
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
      highlights: {
        published_content: publishedContentResult.data ?? [],
        upcoming_schedules: upcomingSchedulesResult.data ?? [],
      },
      meta: {
        org_id: org.orgId,
        workspace_id: workspace.workspaceId,
        workspace_name: workspace.workspaceName,
        role: workspace.role,
      },
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load portfolio metrics' },
      { status }
    )
  }
}
