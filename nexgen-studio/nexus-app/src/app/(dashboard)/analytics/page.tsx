'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppHero } from '@/components/layout/AppHero'
import { useWorkspace } from '@/context/WorkspaceContext'
import apiFetch from '@/lib/core/api'
import { Loader2 } from 'lucide-react'

type AnalyticsMetrics = {
  creators: number
  content: number
  schedules: number
  views: number
  engagement: number
  revenue: number
}

type DayBreakdown = { day: string; views: number; engagement: number; revenue: number }
type PlatformBreakdown = { platform: string; views: number; engagement: number; revenue: number }
type CreatorBreakdown = { creator_id: string; creator_name: string; views: number; engagement: number; revenue: number }

type AnalyticsResponse = {
  metrics: AnalyticsMetrics
  breakdowns: {
    by_day: DayBreakdown[]
    by_platform: PlatformBreakdown[]
    by_creator: CreatorBreakdown[]
  }
  meta: { workspace_name: string }
}

type GenerationMetricsResponse = {
  metrics: {
    totals: {
      totalJobs: number
      imageJobs: number
      videoJobs: number
      completedJobs: number
      failedJobs: number
      cancelledJobs: number
      retryingJobs: number
      retryRate: number
      averageCompletionSeconds: number | null
      stuckJobs: number
      finalizedCredits: number
      releasedCredits: number
      reservedCredits: number
    }
    byKind: Array<{
      jobKind: 'image' | 'video'
      total: number
      completed: number
      failed: number
      cancelled: number
      averageCompletionSeconds: number | null
    }>
    usageEvents: Array<{
      eventName: string
      count: number
      units: number
    }>
  }
  meta: {
    from: string
    to: string
    orgId: string
  }
}

function formatDuration(seconds: number | null) {
  if (seconds === null) {
    return 'n/a'
  }

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
}

function MiniBarChart({ data, dataKey }: { data: DayBreakdown[]; dataKey: 'views' | 'engagement' | 'revenue' }) {
  if (data.length === 0) return <p className="text-xs text-muted-foreground">No data for this period.</p>
  const max = Math.max(...data.map((d) => d[dataKey]), 1)
  return (
    <div className="flex items-end gap-[2px] h-24">
      {data.map((d) => {
        const height = Math.max((d[dataKey] / max) * 100, 2)
        return (
          <div key={d.day} className="group relative flex-1 min-w-[3px]">
            <div
              className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
              style={{ height: `${height}%` }}
            />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block whitespace-nowrap rounded bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow-md border border-border z-10">
              {d.day}: {d[dataKey].toLocaleString()}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyticsPage() {
  const { currentWorkspace } = useWorkspace()
  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generationData, setGenerationData] = useState<GenerationMetricsResponse | null>(null)
  const [generationLoading, setGenerationLoading] = useState(true)
  const [generationError, setGenerationError] = useState<string | null>(null)

  useEffect(() => {
    if (!currentWorkspace?.id) return
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const params = new URLSearchParams({ workspace_id: currentWorkspace!.id })
        const res = await apiFetch(`/analytics?${params}`)
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error((payload as { detail?: string }).detail || 'Failed to load analytics')
        }
        const json = (await res.json()) as AnalyticsResponse
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [currentWorkspace?.id])

  useEffect(() => {
    let cancelled = false
    setGenerationLoading(true)
    setGenerationError(null)

    async function loadGenerationMetrics() {
      try {
        const res = await apiFetch('/analytics/generation')
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error((payload as { detail?: string }).detail || 'Failed to load generation analytics')
        }

        const json = (await res.json()) as GenerationMetricsResponse
        if (!cancelled) {
          setGenerationData(json)
        }
      } catch (e) {
        if (!cancelled) {
          setGenerationError(e instanceof Error ? e.message : 'Failed to load generation analytics')
        }
      } finally {
        if (!cancelled) {
          setGenerationLoading(false)
        }
      }
    }

    void loadGenerationMetrics()
    return () => { cancelled = true }
  }, [])

  const m = data?.metrics
  const generationTotals = generationData?.metrics.totals

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Insights"
        title="Analytics"
        description="Track content performance, audience growth, engagement rates, and revenue across all your platforms."
        actions={
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        }
        metrics={m ? [
          { label: 'Total Views', value: m.views.toLocaleString() },
          { label: 'Engagement', value: m.engagement.toLocaleString() },
          { label: 'Revenue', value: `$${m.revenue.toFixed(2)}` },
        ] : undefined}
      />

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Generation Operations</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Shared operational metrics for durable image and video jobs.
            </p>
          </div>
          {generationLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardHeader>
        <CardContent className="space-y-4">
          {generationError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {generationError}
            </div>
          ) : generationTotals ? (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Jobs</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">{generationTotals.totalJobs}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Completed</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">{generationTotals.completedJobs}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Failed</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">{generationTotals.failedJobs}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cancelled</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">{generationTotals.cancelledJobs}</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Retry Rate</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">{Math.round(generationTotals.retryRate * 100)}%</CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Stuck Jobs</CardTitle></CardHeader>
                  <CardContent className="text-2xl font-semibold">{generationTotals.stuckJobs}</CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>By Media Kind</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {generationData.metrics.byKind.map((entry) => (
                      <div key={entry.jobKind} className="rounded-md border border-border px-3 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium capitalize">{entry.jobKind}</span>
                          <span className="text-sm text-muted-foreground">{entry.total} jobs</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                          <span>Completed: {entry.completed}</span>
                          <span>Failed: {entry.failed}</span>
                          <span>Cancelled: {entry.cancelled}</span>
                          <span>Avg: {formatDuration(entry.averageCompletionSeconds)}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Usage Accounting</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="text-muted-foreground">Reserved credits</span>
                      <span className="font-medium">{generationTotals.reservedCredits}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="text-muted-foreground">Finalized credits</span>
                      <span className="font-medium">{generationTotals.finalizedCredits}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="text-muted-foreground">Released credits</span>
                      <span className="font-medium">{generationTotals.releasedCredits}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <span className="text-muted-foreground">Average completion</span>
                      <span className="font-medium">{formatDuration(generationTotals.averageCompletionSeconds)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Event Mix</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {generationData.metrics.usageEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No usage events recorded yet.</p>
                    ) : generationData.metrics.usageEvents.slice(0, 6).map((event) => (
                      <div key={event.eventName} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                        <span className="font-medium">{event.eventName.replaceAll('_', ' ')}</span>
                        <span className="text-muted-foreground">
                          {event.count} events
                          {event.units > 0 ? ` | ${event.units} units` : ''}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No generation analytics available yet.</p>
          )}
        </CardContent>
      </Card>

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Creators</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{m!.creators}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Content Items</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{m!.content}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Scheduled</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{m!.schedules}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Views</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{m!.views.toLocaleString()}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Engagement</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">{m!.engagement.toLocaleString()}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Revenue</CardTitle></CardHeader>
              <CardContent className="text-2xl font-semibold">${m!.revenue.toFixed(2)}</CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Views over time</CardTitle>
              </CardHeader>
              <CardContent>
                <MiniBarChart data={data.breakdowns.by_day} dataKey="views" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>By Platform</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.breakdowns.by_platform.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No platform data yet.</p>
                ) : data.breakdowns.by_platform.map((p) => (
                  <div key={p.platform} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm font-medium capitalize">{p.platform}</span>
                    <span className="text-sm text-muted-foreground">{p.views.toLocaleString()} views</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Engagement over time</CardTitle>
              </CardHeader>
              <CardContent>
                <MiniBarChart data={data.breakdowns.by_day} dataKey="engagement" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Creators</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.breakdowns.by_creator.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No creator performance data yet.</p>
                ) : data.breakdowns.by_creator.slice(0, 5).map((c) => (
                  <div key={c.creator_id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                    <span className="text-sm font-medium">{c.creator_name}</span>
                    <div className="flex gap-4 text-sm text-muted-foreground">
                      <span>{c.views.toLocaleString()} views</span>
                      <span>${c.revenue.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
