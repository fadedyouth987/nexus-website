'use client'

import type { PerformancePoint } from './types'

function maxValue(values: number[]) {
  const max = Math.max(...values, 1)
  return max <= 0 ? 1 : max
}

export function PerformanceCharts({ points }: { points: PerformancePoint[] }) {
  if (!points.length) {
    return <div className="text-sm text-muted-foreground">No performance data available.</div>
  }

  const viewsMax = maxValue(points.map((point) => point.views))
  const engagementMax = maxValue(points.map((point) => point.engagement))

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-lg border p-4">
        <h4 className="mb-3 text-sm font-medium">Views Over Time</h4>
        <div className="flex h-40 items-end gap-2">
          {points.slice(-14).map((point) => (
            <div key={`${point.day}-views`} className="flex-1 rounded bg-blue-500/80" style={{ height: `${(point.views / viewsMax) * 100}%` }} />
          ))}
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <h4 className="mb-3 text-sm font-medium">Engagement Over Time</h4>
        <div className="flex h-40 items-end gap-2">
          {points.slice(-14).map((point) => (
            <div key={`${point.day}-eng`} className="flex-1 rounded bg-emerald-500/80" style={{ height: `${(point.engagement / engagementMax) * 100}%` }} />
          ))}
        </div>
      </div>
    </div>
  )
}
