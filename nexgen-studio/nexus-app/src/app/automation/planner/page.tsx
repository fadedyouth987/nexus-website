'use client'

import PlannerPage from '@/app/planner/page'
import CalendarPage from '@/app/calendar/page'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AutomationPlannerWorkspacePage() {
  return (
    <div className="space-y-[var(--section-gap)]">
      <PageHeader
        title="Planner + Scheduler"
        description="Run planning and scheduling in one workspace."
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Automation', href: '/automation' },
          { label: 'Planner + Scheduler' },
        ]}
      />

      <div className="grid gap-6 2xl:grid-cols-2">
        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Planner</CardTitle>
            <CardDescription>Chat-driven content calendar planning and generation.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-5">
            <PlannerPage embedded />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/70">
            <CardTitle>Scheduler</CardTitle>
            <CardDescription>Queue and manage schedule status for planned content.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-5">
            <CalendarPage embedded />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
