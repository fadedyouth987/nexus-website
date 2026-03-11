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

  const m = data?.metrics

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
