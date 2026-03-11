'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StrategyProfileCard } from './StrategyProfileCard'
import { CalendarGrid, type ContentItem } from './CalendarGrid'
import { VersionHistory } from './VersionHistory'

export type PlanSummary = {
  id: string
  name?: string
  status?: string
  duration_days?: number
  timezone?: string
  brief?: Record<string, unknown> | null
  strategy?: Record<string, unknown> | null
}

type PlanBuilderPanelProps = {
  planSummary: PlanSummary | null
  contentItems: ContentItem[]
  planId: string | null
  onRegenerateRange?: (fromDay: number, toDay: number, instruction: string) => Promise<void>
  loading?: boolean
}

export function PlanBuilderPanel({
  planSummary,
  contentItems,
  planId,
  onRegenerateRange,
  loading,
}: PlanBuilderPanelProps) {
  const strategy = planSummary?.strategy ?? null

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {planSummary && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base text-foreground">Plan</CardTitle>
            <Badge variant="secondary">{planSummary.status ?? 'draft'}</Badge>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium text-foreground">{planSummary.name ?? 'Untitled plan'}</p>
            <p className="text-muted-foreground">
              {planSummary.duration_days ?? 30} days · {planSummary.timezone ?? 'UTC'}
            </p>
          </CardContent>
        </Card>
      )}

      <StrategyProfileCard strategy={strategy as { content_pillars_json?: string[]; funnel_stages_json?: string[]; weekly_rhythm_json?: Record<string, string>; cta_rules_json?: Record<string, string> } | null} />

      <CalendarGrid
        items={contentItems}
        planId={planId}
        onRegenerateRange={onRegenerateRange}
        loading={loading}
      />

      <VersionHistory planId={planId} />
    </div>
  )
}
