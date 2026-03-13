'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarClock, PauseCircle, PlayCircle, Rocket } from 'lucide-react'
import apiFetch from '@/lib/core/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { ScheduledContentRunDetail } from '@/modules/scheduling'

function formatDate(value: string | null) {
  if (!value) {
    return 'Not available'
  }
  return new Date(value).toLocaleString()
}

export function ScheduledContentRunDetailClient({
  initialDetail,
}: {
  initialDetail: ScheduledContentRunDetail
}) {
  const router = useRouter()
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { schedule, executions, jobs } = initialDetail

  async function runAction(action: 'pause' | 'resume' | 'run-now') {
    setWorking(true)
    setError(null)

    try {
      const response = await apiFetch(`/scheduled-content-runs/${schedule.id}/${action}`, {
        method: 'POST',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to update schedule')
      }

      router.refresh()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Failed to update schedule')
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              <CalendarClock className="h-3.5 w-3.5" />
              Scheduled content run
            </div>
            <CardTitle className="mt-4 text-3xl font-semibold tracking-tight">{schedule.title}</CardTitle>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{schedule.brief}</p>
            <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em]">Status</div>
                <div className="mt-2 font-medium text-foreground">{schedule.status}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em]">Recurrence</div>
                <div className="mt-2 font-medium text-foreground">
                  {schedule.frequency} at {schedule.time_of_day}
                </div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em]">Next run</div>
                <div className="mt-2 font-medium text-foreground">{formatDate(schedule.next_run_at)}</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
                <div className="text-[11px] uppercase tracking-[0.18em]">Jobs per run</div>
                <div className="mt-2 font-medium text-foreground">{schedule.jobs_per_run}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/schedules/${schedule.id}/edit`}>Edit</Link>
            </Button>
            {schedule.status === 'paused' ? (
              <Button onClick={() => runAction('resume')} disabled={working}>
                <PlayCircle className="mr-2 h-4 w-4" />
                Resume
              </Button>
            ) : (
              <Button variant="outline" onClick={() => runAction('pause')} disabled={working || schedule.status === 'running'}>
                <PauseCircle className="mr-2 h-4 w-4" />
                Pause
              </Button>
            )}
            <Button variant="outline" onClick={() => runAction('run-now')} disabled={working}>
              <Rocket className="mr-2 h-4 w-4" />
              Run now
            </Button>
          </div>
        </CardHeader>
        {error ? (
          <CardContent>
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          </CardContent>
        ) : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Recent executions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {executions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No execution history yet.</p>
            ) : executions.map((execution) => (
              <div key={execution.id} className="rounded-2xl border border-border/70 bg-background/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{execution.trigger_type} run</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Scheduled for {formatDate(execution.scheduled_for)}
                    </div>
                  </div>
                  <span className="rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {execution.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Jobs requested: {execution.jobs_requested}</span>
                  <span>Jobs created: {execution.jobs_created}</span>
                  <span>Started: {formatDate(execution.started_at)}</span>
                </div>
                {execution.error_message ? (
                  <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    {execution.error_message}
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Generated jobs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">This schedule has not created any durable jobs yet.</p>
            ) : jobs.map((job) => (
              <div key={job.id} className="rounded-2xl border border-border/70 bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/video-jobs/${job.id}`} className="text-sm font-semibold text-foreground hover:text-primary">
                      {job.title}
                    </Link>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {job.job_kind} job • {job.progress}% • {formatDate(job.created_at)}
                    </div>
                  </div>
                  <span className="rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {job.status}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
