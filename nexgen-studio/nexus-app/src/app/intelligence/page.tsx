'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import apiFetch from '@/lib/core/api'
import { isPortfolioV2ClientEnabled } from '@/lib/core/featureFlags'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useWorkspace } from '@/context/WorkspaceContext'
import { AssistantChat } from '@/components/intelligence/AssistantChat'

type WorkspaceV2 = {
  id: string
  name: string
}

type PortfolioResponse = {
  metrics: {
    creators: number
    content: number
    schedules: number
    views: number
    engagement: number
    revenue: number
  }
  analytics: {
    by_creator: Array<{
      creator_id: string
      creator_name: string
      views: number
      engagement: number
      revenue: number
    }>
    by_platform: Array<{
      platform: string
      views: number
      engagement: number
      revenue: number
    }>
    by_day: Array<{
      day: string
      views: number
      engagement: number
      revenue: number
    }>
  }
  highlights: {
    published_content: Array<{
      id: string
      type: string
      status: string
      created_at: string
    }>
    upcoming_schedules: Array<{
      id: string
      content_id: string
      platform: string | null
      scheduled_for: string | null
      status: string
    }>
  }
  meta: {
    org_id: string
    workspace_id: string
    workspace_name: string
    role: string
  }
}

type AnalyticsResponse = {
  metrics: PortfolioResponse['metrics']
  breakdowns: {
    by_creator: PortfolioResponse['analytics']['by_creator']
    by_platform: PortfolioResponse['analytics']['by_platform']
    by_day: PortfolioResponse['analytics']['by_day']
  }
  meta: PortfolioResponse['meta']
}

type WorkerHealthResponse = {
  config?: {
    supabase_admin_ready: boolean
    redis_ready: boolean
    publisher_mode: string
    worker_intervals: {
      publish_ms: number
      ingest_ms: number
    }
    v2_enabled: boolean
  }
  throughput: {
    window_min: number
    published: number
    failed: number
    performance_writes: number
  }
  queue: {
    due_backlog: number
  }
  latest: {
    published: {
      id: string
      content_id: string
      platform: string | null
      created_at: string
    } | null
    failed: {
      id: string
      content_id: string
      platform: string | null
      created_at: string
      error?: Record<string, unknown>
    } | null
    performance: {
      id: string
      content_id: string
      platform: string | null
      recorded_at: string
      views: number
      engagement: number
      revenue: number
    } | null
  }
}

function LegacyIntelligencePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-foreground">Intelligence</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        v2 placeholder. This area will consolidate portfolio analytics, revenue, audience, and reporting on top of
        `performance_v2`.
      </p>
    </div>
  )
}

function IntelligenceV2Page() {
  const { status } = useSession()
  const router = useRouter()
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceV2[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null)
  const [workerHealth, setWorkerHealth] = useState<WorkerHealthResponse | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadPortfolio = useCallback(async (workspaceId: string, opts: { silent?: boolean } = {}) => {
    if (opts.silent) {
      setRefreshing(true)
    } else {
      setLoading(true)
      setError(null)
    }

    try {
      const [analyticsResponse, highlightsResponse, workerHealthResponse] = await Promise.all([
        apiFetch(`/analytics?workspace_id=${workspaceId}`),
        apiFetch(`/portfolio?workspace_id=${workspaceId}`),
        apiFetch(`/worker/health?workspace_id=${workspaceId}`),
      ])

      if (!analyticsResponse.ok) {
        const payload = await analyticsResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load portfolio metrics')
      }

      if (!highlightsResponse.ok) {
        const payload = await highlightsResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load portfolio highlights')
      }

      if (!workerHealthResponse.ok) {
        const payload = await workerHealthResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load worker health')
      }

      const analyticsPayload = (await analyticsResponse.json()) as AnalyticsResponse
      const highlightsPayload = (await highlightsResponse.json()) as Pick<PortfolioResponse, 'highlights'>
      const workerHealthPayload = (await workerHealthResponse.json()) as WorkerHealthResponse
      setPortfolio({
        metrics: analyticsPayload.metrics,
        analytics: {
          by_creator: analyticsPayload.breakdowns.by_creator,
          by_platform: analyticsPayload.breakdowns.by_platform,
          by_day: analyticsPayload.breakdowns.by_day,
        },
        highlights: highlightsPayload.highlights || {
          published_content: [],
          upcoming_schedules: [],
        },
        meta: analyticsPayload.meta,
      })
      setWorkerHealth(workerHealthPayload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio metrics')
    } finally {
      if (opts.silent) {
        setRefreshing(false)
      } else {
        setLoading(false)
      }
    }
  }, [])

  const boot = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const workspaceResponse = await apiFetch('/workspaces')
      if (!workspaceResponse.ok) {
        const payload = await workspaceResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load workspaces')
      }

      const workspaceRows = (await workspaceResponse.json()) as WorkspaceV2[]
      setWorkspaces(workspaceRows)

      if (workspaceRows.length > 0) {
        const preferredWorkspace =
          (currentWorkspace && workspaceRows.find((workspace) => workspace.id === currentWorkspace.id)) ||
          workspaceRows[0]
        setSelectedWorkspaceId(preferredWorkspace.id)
        setCurrentWorkspace(preferredWorkspace)
      } else {
        setPortfolio(null)
        setWorkerHealth(null)
        setCurrentWorkspace(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intelligence')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace, setCurrentWorkspace])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }

    if (status === 'authenticated') {
      void boot()
    }
  }, [status, router, boot])

  useEffect(() => {
    if (selectedWorkspaceId) {
      void loadPortfolio(selectedWorkspaceId)
    }
  }, [selectedWorkspaceId, loadPortfolio])

  useEffect(() => {
    if (currentWorkspace?.id && currentWorkspace.id !== selectedWorkspaceId) {
      setSelectedWorkspaceId(currentWorkspace.id)
    }
  }, [currentWorkspace?.id, selectedWorkspaceId])

  useEffect(() => {
    if (!selectedWorkspaceId) return

    const timer = setInterval(() => {
      void loadPortfolio(selectedWorkspaceId, { silent: true })
    }, 20000)

    return () => clearInterval(timer)
  }, [selectedWorkspaceId, loadPortfolio])

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">Intelligence</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Read-only analytics slice powered by `/api/portfolio` over `creators_v2`, `content_v2`, `schedules_v2`,
            and `performance_v2`.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <label className="mb-2 block text-sm font-medium text-foreground">Workspace</label>
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={selectedWorkspaceId}
            onChange={(event) => {
              const nextWorkspaceId = event.target.value
              setSelectedWorkspaceId(nextWorkspaceId)
              const selectedWorkspace = workspaces.find((workspace) => workspace.id === nextWorkspaceId)
              setCurrentWorkspace(selectedWorkspace || null)
            }}
          >
            <option value="">Select workspace</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {workerHealth?.config && (!workerHealth.config.supabase_admin_ready || !workerHealth.config.redis_ready) ? (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-800">
            Worker publish/ingest readiness is incomplete.
            {!workerHealth.config.supabase_admin_ready ? ' Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.' : ''}
            {!workerHealth.config.redis_ready ? ' Missing REDIS_URL.' : ''}
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Creators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{portfolio?.metrics.creators || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{portfolio?.metrics.content || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{portfolio?.metrics.schedules || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Views</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{portfolio?.metrics.views || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Engagement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{portfolio?.metrics.engagement || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">${(portfolio?.metrics.revenue || 0).toFixed(2)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{refreshing ? 'Refreshing...' : 'Live updates every 20s'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Worker Published</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workerHealth?.throughput.published || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">last {workerHealth?.throughput.window_min || 60}m</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Worker Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workerHealth?.throughput.failed || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">last {workerHealth?.throughput.window_min || 60}m</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Perf Writes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workerHealth?.throughput.performance_writes || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">last {workerHealth?.throughput.window_min || 60}m</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Due Backlog</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{workerHealth?.queue.due_backlog || 0}</div>
            <p className="mt-1 text-xs text-muted-foreground">queued/scheduled past due</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Published Content</CardTitle>
            <CardDescription>Latest published items in the selected workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {portfolio?.highlights.published_content?.length ? (
              portfolio.highlights.published_content.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="font-medium text-foreground">{item.type}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.status} | {new Date(item.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No published content yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Schedule Queue</CardTitle>
            <CardDescription>Next queued and scheduled deliveries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {portfolio?.highlights.upcoming_schedules?.length ? (
              portfolio.highlights.upcoming_schedules.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="font-medium text-foreground">{item.platform || 'No platform'}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.status} | {item.scheduled_for ? new Date(item.scheduled_for).toLocaleString() : 'No date'}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No upcoming schedules yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>By Platform</CardTitle>
            <CardDescription>Latest snapshot rollup per platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {portfolio?.analytics.by_platform?.length ? (
              portfolio.analytics.by_platform.map((item) => (
                <div key={item.platform} className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="font-medium text-foreground">{item.platform}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.views} views | {item.engagement} engagement | ${item.revenue.toFixed(2)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No platform analytics yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>By Creator</CardTitle>
            <CardDescription>Latest snapshot rollup per creator.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {portfolio?.analytics.by_creator?.length ? (
              portfolio.analytics.by_creator.map((item) => (
                <div key={item.creator_id} className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="font-medium text-foreground">{item.creator_name}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{item.creator_id}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.views} views | {item.engagement} engagement | ${item.revenue.toFixed(2)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No creator analytics yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Trend</CardTitle>
            <CardDescription>Latest snapshot rollup by day.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {portfolio?.analytics.by_day?.length ? (
              portfolio.analytics.by_day.map((item) => (
                <div key={item.day} className="rounded-lg border border-slate-200 px-4 py-3">
                  <div className="font-medium text-foreground">{item.day}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.views} views | {item.engagement} engagement | ${item.revenue.toFixed(2)}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No daily analytics yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-3">Nexus</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Ask Nexus about analytics, automation, scheduling, or platform help.
        </p>
        <AssistantChat scope="intelligence" title="Nexus" className="max-w-xl" />
      </div>
    </div>
  )
}

export default function IntelligencePage() {
  return isPortfolioV2ClientEnabled() ? <IntelligenceV2Page /> : <LegacyIntelligencePage />
}
