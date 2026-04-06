'use client'

import { useMemo, useState } from 'react'
import { AppHero } from '@/components/layout/AppHero'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { CreatorMetricsTable } from './CreatorMetricsTable'
import { PerformanceCharts } from './PerformanceCharts'
import type {
  CreatorMetricsRow,
  PerformancePoint,
  WorkspaceMetricsRow,
  WorkspaceRow,
} from './types'

export function AgencyDashboardClient({
  workspaces,
  workspaceMetrics,
  creatorMetrics,
  performancePoints,
}: {
  workspaces: WorkspaceRow[]
  workspaceMetrics: WorkspaceMetricsRow[]
  creatorMetrics: CreatorMetricsRow[]
  performancePoints: PerformancePoint[]
}) {
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaces[0]?.id || '')

  const selectedWorkspaceMetrics = useMemo(
    () => workspaceMetrics.find((row) => row.workspace_id === selectedWorkspaceId) || null,
    [workspaceMetrics, selectedWorkspaceId]
  )

  const workspaceCreators = useMemo(
    () => creatorMetrics.filter((row) => row.workspace_id === selectedWorkspaceId),
    [creatorMetrics, selectedWorkspaceId]
  )

  const workspacePerformance = useMemo(
    () => performancePoints.filter((point) => point.workspace_id === selectedWorkspaceId),
    [performancePoints, selectedWorkspaceId]
  )

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6" suppressHydrationWarning>
      <AppHero
        eyebrow="System"
        title="Agency Dashboard"
        description="Manage multiple workspaces, track creator performance, and oversee production metrics."
        actions={
          <div className="w-64">
            <WorkspaceSwitcher
              workspaces={workspaces}
              selectedWorkspaceId={selectedWorkspaceId}
              onSelectWorkspace={setSelectedWorkspaceId}
            />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total Posts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {selectedWorkspaceMetrics?.total_posts || 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Generated Assets</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {selectedWorkspaceMetrics?.total_generated_assets || 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Engagement</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {selectedWorkspaceMetrics?.engagement_total || 0}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Plans Completed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {(selectedWorkspaceMetrics?.plan_completed_count || 0)}/{selectedWorkspaceMetrics?.plan_count || 0}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Creators</CardTitle>
        </CardHeader>
        <CardContent>
          <CreatorMetricsTable rows={workspaceCreators} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <PerformanceCharts points={workspacePerformance} />
        </CardContent>
      </Card>
    </div>
  )
}
