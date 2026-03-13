'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, PauseCircle, PlayCircle, Rocket, ArrowRight } from 'lucide-react'
import apiFetch from '@/lib/core/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ScheduledContentRunRecord } from '@/modules/scheduling'

function formatDate(value: string | null) {
  if (!value) {
    return 'Not scheduled'
  }

  return new Date(value).toLocaleString()
}

function scheduleStateLabel(schedule: ScheduledContentRunRecord) {
  if (schedule.status === 'paused') {
    return 'Paused'
  }
  if (schedule.status === 'running') {
    return 'Running'
  }
  return 'Scheduled'
}

export function ScheduledContentRunsListClient({
  initialSchedules,
}: {
  initialSchedules: ScheduledContentRunRecord[]
}) {
  const router = useRouter()
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function runAction(scheduleId: string, action: 'pause' | 'resume' | 'run-now') {
    setWorkingId(scheduleId)
    setError(null)

    try {
      const response = await apiFetch(`/scheduled-content-runs/${scheduleId}/${action}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to update schedule')
      }

      if (action === 'run-now') {
        router.push(`/schedules/${scheduleId}`)
      } else {
        router.refresh()
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to update schedule')
    } finally {
      setWorkingId(null)
    }
  }

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
            <CalendarClock className="h-3.5 w-3.5" />
            Schedules
          </div>
          <CardTitle className="mt-4 text-3xl font-semibold tracking-tight">Recurring content runs keep image and video generation moving without bypassing the durable job backbone.</CardTitle>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Each schedule fans into the same durable generation jobs, assets, and accounting flow as manual Studio work. Use these for daily stills, weekly clips, and future review or publishing pipelines.
          </p>
        </div>
        <Button asChild className="shrink-0 gap-2">
          <Link href="/schedules/new">
            New schedule
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {initialSchedules.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
            No recurring schedules yet. Create one to start generating durable image or video jobs on a fixed cadence.
          </div>
        ) : (
          initialSchedules.map((schedule) => (
            <div key={schedule.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/schedules/${schedule.id}`} className="text-lg font-semibold tracking-tight text-foreground hover:text-primary">
                      {schedule.title}
                    </Link>
                    <span className="rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {schedule.job_kind}
                    </span>
                    <span className="rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {scheduleStateLabel(schedule)}
                    </span>
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{schedule.brief}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Frequency: {schedule.frequency}</span>
                    <span>Jobs per run: {schedule.jobs_per_run}</span>
                    <span>Next run: {formatDate(schedule.next_run_at)}</span>
                    <span>Last success: {formatDate(schedule.last_success_at)}</span>
                  </div>
                  {schedule.last_error_message ? (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      Last error: {schedule.last_error_message}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/schedules/${schedule.id}`}>Open</Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/schedules/${schedule.id}/edit`}>Edit</Link>
                  </Button>
                  {schedule.status === 'paused' ? (
                    <Button size="sm" onClick={() => runAction(schedule.id, 'resume')} disabled={workingId === schedule.id}>
                      <PlayCircle className="mr-2 h-4 w-4" />
                      Resume
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => runAction(schedule.id, 'pause')} disabled={workingId === schedule.id || schedule.status === 'running'}>
                      <PauseCircle className="mr-2 h-4 w-4" />
                      Pause
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => runAction(schedule.id, 'run-now')} disabled={workingId === schedule.id}>
                    <Rocket className="mr-2 h-4 w-4" />
                    Run now
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
