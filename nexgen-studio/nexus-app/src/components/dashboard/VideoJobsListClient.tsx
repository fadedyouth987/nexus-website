'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clapperboard, ArrowRight } from 'lucide-react'
import apiFetch from '@/lib/core/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type VideoJobListItem = {
  id: string
  job_kind: 'video' | 'image'
  title: string
  brief: string
  status: string
  progress: number
  retry_count: number
  failure_code: string | null
  error_message: string | null
  diagnostics?: {
    isStuck: boolean
    stuckReason: string | null
  }
}

const CANCELLABLE_STATUSES = new Set(['queued', 'planning', 'generating_assets', 'rendering', 'uploading'])

export function VideoJobsListClient({
  initialJobs,
}: {
  initialJobs: VideoJobListItem[]
}) {
  const router = useRouter()
  const [actionState, setActionState] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function runAction(jobId: string, action: 'retry' | 'cancel' | 'duplicate') {
    setActionState(`${jobId}:${action}`)
    setActionError(null)

    const response = await apiFetch(`/video-jobs/${jobId}/${action === 'duplicate' ? 'duplicate' : action}`, {
      method: 'POST',
    })
    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setActionState(null)
      setActionError((payload as { detail?: string }).detail || 'Action failed')
      return null
    }

    setActionState(null)
    return payload
  }

  async function handleCancel(jobId: string) {
    if (!window.confirm('Cancel this generation job? This is best-effort once upstream generation has started.')) {
      return
    }

    const payload = await runAction(jobId, 'cancel')
    if (!payload) {
      return
    }

    router.refresh()
  }

  async function handleRetry(jobId: string) {
    const payload = await runAction(jobId, 'retry')
    if (!payload) {
      return
    }

    router.refresh()
  }

  async function handleDuplicate(jobId: string) {
    const payload = await runAction(jobId, 'duplicate')
    if (!payload) {
      return
    }

    const nextId = (payload as { job?: { id?: string }; id?: string }).job?.id || (payload as { id?: string }).id

    if (nextId) {
      router.push(`/video-jobs/${nextId}`)
      return
    }

    router.refresh()
  }

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              <Clapperboard className="h-3.5 w-3.5" />
              Generation Jobs
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Durable generation jobs now have real operational controls.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Submit image and video work through durable campaign-backed records, track worker progress, cancel stuck jobs, retry failures, and run proven job contexts again without rebuilding the brief.
            </p>
          </div>
          <Button asChild className="shrink-0 gap-2">
            <Link href="/video-jobs/new">
              New generation job
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {actionError ? (
          <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        ) : null}

        <div className="mt-6 grid gap-3">
          {initialJobs.length > 0 ? (
            initialJobs.map((job) => {
              const actionKeyPrefix = `${job.id}:`
              return (
                <div key={job.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold tracking-tight text-foreground">{job.title}</h2>
                        <span className="rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          {job.job_kind}
                        </span>
                        <span className="rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          {job.status} {job.progress}%
                        </span>
                        {job.retry_count ? (
                          <span className="rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                            Retry {job.retry_count}
                          </span>
                        ) : null}
                        {job.diagnostics?.isStuck ? (
                          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-amber-900 dark:text-amber-200">
                            Stuck
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{job.brief}</p>
                      {job.failure_code || job.error_message || job.diagnostics?.stuckReason ? (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {[job.failure_code, job.error_message, job.diagnostics?.stuckReason].filter(Boolean).join(' · ')}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        <Link href={`/video-jobs/${job.id}`} className="font-medium text-primary">Open</Link>
                        <Link href={`/video-jobs/${job.id}/edit`} className="font-medium text-muted-foreground hover:text-foreground">Edit</Link>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => void handleDuplicate(job.id)}
                        disabled={actionState !== null}
                        variant="outline"
                        size="sm"
                      >
                        {actionState === `${actionKeyPrefix}duplicate` ? 'Starting...' : 'Run again'}
                      </Button>
                      {job.status === 'failed' ? (
                        <Button
                          onClick={() => void handleRetry(job.id)}
                          disabled={actionState !== null}
                          size="sm"
                        >
                          {actionState === `${actionKeyPrefix}retry` ? 'Retrying...' : 'Retry'}
                        </Button>
                      ) : null}
                      {CANCELLABLE_STATUSES.has(job.status) ? (
                        <Button
                          onClick={() => void handleCancel(job.id)}
                          disabled={actionState !== null}
                          variant="outline"
                          size="sm"
                        >
                          {actionState === `${actionKeyPrefix}cancel` ? 'Cancelling...' : 'Cancel'}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
              No records yet. The new module and API are in place, so this page will populate once you start creating items through the app or API.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
