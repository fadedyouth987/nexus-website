'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import apiFetch from '@/lib/core/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type VideoJobDetailPayload = {
  job: {
    id: string
    job_kind: 'video' | 'image'
    title: string
    brief: string
    script: string | null
    status: string
    progress: number
    error_message: string | null
    started_at: string | null
    completed_at: string | null
    failed_at: string | null
    last_heartbeat_at: string | null
    retry_count: number
    failure_stage: string | null
    failure_code: string | null
    campaign_id: string | null
    project_id: string | null
    brand_kit_id: string | null
    source_generation_job_id: string | null
    metadata: Record<string, unknown>
    diagnostics?: {
      isStuck: boolean
      stuckReason: string | null
      hasStaleHeartbeat: boolean
      isQueuedTooLong: boolean
    }
    created_at: string
    updated_at: string
  }
  assets: Array<{
    id: string
    kind: string
    storage_url: string | null
    created_at: string
    signedUrl?: string
  }>
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])
const CANCELLABLE_STATUSES = new Set(['queued', 'planning', 'generating_assets', 'rendering', 'uploading'])

async function resolveAssetUrls(assets: VideoJobDetailPayload['assets']) {
  return Promise.all(
    assets.map(async (asset) => {
      try {
        const response = await apiFetch(`/assets/${asset.id}/signed-url`)
        if (!response.ok) {
          return asset
        }
        const payload = await response.json().catch(() => ({}))
        return { ...asset, signedUrl: payload.signedUrl as string | undefined }
      } catch {
        return asset
      }
    })
  )
}

function readCancellationSummary(metadata: Record<string, unknown>) {
  const cancellation =
    metadata.cancellation && typeof metadata.cancellation === 'object'
      ? metadata.cancellation as Record<string, unknown>
      : null

  if (!cancellation) {
    return null
  }

  return {
    requestedAt:
      typeof cancellation.requestedAt === 'string' ? cancellation.requestedAt : null,
    cancelledAt:
      typeof cancellation.cancelledAt === 'string' ? cancellation.cancelledAt : null,
    requestedBy:
      typeof cancellation.requestedBy === 'string' ? cancellation.requestedBy : null,
    reason:
      typeof cancellation.reason === 'string' ? cancellation.reason : null,
    upstreamError:
      typeof cancellation.upstreamError === 'string' ? cancellation.upstreamError : null,
  }
}

export function VideoJobDetailClient({
  initialData,
}: {
  initialData: VideoJobDetailPayload
}) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [actionState, setActionState] = useState<'retry' | 'cancel' | 'duplicate' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const response = await apiFetch(`/video-jobs/${initialData.job.id}`)
    if (!response.ok) {
      return
    }
    const payload = await response.json()
    const assets = await resolveAssetUrls(payload.assets ?? [])
    setData({ ...payload, assets })
  }, [initialData.job.id])

  useEffect(() => {
    let cancelled = false

    async function runRefresh() {
      if (cancelled) {
        return
      }
      await refresh()
    }

    void runRefresh()

    if (TERMINAL_STATUSES.has(data.job.status)) {
      return () => {
        cancelled = true
      }
    }

    const interval = window.setInterval(() => {
      void runRefresh()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [data.job.status, initialData.job.id, refresh])

  const metadata = data.job.metadata ?? {}
  const inputs = metadata.inputs && typeof metadata.inputs === 'object'
    ? metadata.inputs as Record<string, unknown>
    : {}
  const cancellation = readCancellationSummary(metadata)
  const canRetry = data.job.status === 'failed'
  const canCancel = CANCELLABLE_STATUSES.has(data.job.status)

  async function runAction(
    action: 'retry' | 'cancel' | 'duplicate',
    path: string
  ) {
    setActionState(action)
    setActionError(null)

    const response = await apiFetch(path, {
      method: 'POST',
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      setActionState(null)
      setActionError((payload as { detail?: string }).detail || 'Action failed')
      return null
    }

    return payload
  }

  async function handleRetry() {
    const payload = await runAction('retry', `/video-jobs/${data.job.id}/retry`)
    if (!payload) {
      return
    }

    await refresh()
    router.refresh()
    setActionState(null)
  }

  async function handleCancel() {
    if (!window.confirm('Cancel this generation job? This is best-effort once upstream generation has started.')) {
      return
    }

    const payload = await runAction('cancel', `/video-jobs/${data.job.id}/cancel`)
    if (!payload) {
      return
    }

    await refresh()
    router.refresh()
    setActionState(null)
  }

  async function handleDuplicate() {
    const payload = await runAction('duplicate', `/video-jobs/${data.job.id}/duplicate`)
    if (!payload) {
      return
    }

    const nextId = (payload as { job?: { id?: string }; id?: string }).job?.id || (payload as { id?: string }).id
    setActionState(null)

    if (nextId) {
      router.push(`/video-jobs/${nextId}`)
      return
    }

    await refresh()
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">{data.job.title}</h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{data.job.brief}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href={`/video-jobs/${data.job.id}/edit`}>Edit</Link>
              </Button>
              <Button
                onClick={() => void handleDuplicate()}
                disabled={actionState !== null}
                variant="outline"
              >
                {actionState === 'duplicate' ? 'Starting...' : 'Run again'}
              </Button>
              {canCancel ? (
                <Button
                  onClick={() => void handleCancel()}
                  disabled={actionState !== null}
                  variant="outline"
                >
                  {actionState === 'cancel' ? 'Cancelling...' : 'Cancel job'}
                </Button>
              ) : null}
              {canRetry ? (
                <Button onClick={() => void handleRetry()} disabled={actionState !== null}>
                  {actionState === 'retry' ? 'Retrying...' : 'Retry job'}
                </Button>
              ) : null}
              <Button asChild>
                <Link href="/video-jobs/new">New job</Link>
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            <MetricCard label="Status" value={data.job.status} />
            <MetricCard label="Media type" value={data.job.job_kind} />
            <MetricCard label="Progress" value={`${data.job.progress}%`} />
            <MetricCard label="Generation job" value={data.job.source_generation_job_id || 'Pending'} />
            <MetricCard label="Updated" value={new Date(data.job.updated_at).toLocaleString()} />
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted/60">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${data.job.progress}%` }} />
          </div>

          {actionError ? (
            <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}

          {data.job.status === 'cancelled' ? (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              {cancellation?.reason || data.job.error_message || 'This job was cancelled before completion.'}
            </div>
          ) : null}

          {data.job.error_message && data.job.status !== 'cancelled' ? (
            <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {data.job.error_message}
            </div>
          ) : null}

          {data.job.diagnostics?.isStuck ? (
            <div className="mt-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
              {data.job.diagnostics.stuckReason}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="space-y-5 p-6">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Input summary</h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <DetailRow label="Project" value={data.job.project_id || 'Not linked'} />
                <DetailRow label="Campaign" value={data.job.campaign_id || 'Not linked'} />
                <DetailRow label="Brand kit" value={data.job.brand_kit_id || 'Not linked'} />
                <DetailRow label="Job kind" value={data.job.job_kind} />
                <DetailRow label="Workflow template" value={typeof metadata.workflowTemplateId === 'string' ? metadata.workflowTemplateId : 'Not set'} />
                <DetailRow label="Influencer" value={typeof metadata.influencerId === 'string' ? metadata.influencerId : 'Not set'} />
                <DetailRow label="Retry count" value={String(data.job.retry_count ?? 0)} />
                <DetailRow label="Failure stage" value={data.job.failure_stage || 'None'} />
                <DetailRow label="Failure code" value={data.job.failure_code || 'None'} />
                <DetailRow label="Aspect ratio" value={typeof inputs.aspect_ratio === 'string' ? inputs.aspect_ratio : 'Not set'} />
                <DetailRow label="Duration" value={typeof inputs.duration_seconds === 'number' ? `${inputs.duration_seconds}s` : 'Not set'} />
                <DetailRow label="Batch size" value={typeof inputs.batch_size === 'number' ? String(inputs.batch_size) : '1'} />
                <DetailRow label="Started" value={data.job.started_at ? new Date(data.job.started_at).toLocaleString() : 'Not started'} />
                <DetailRow label="Completed" value={data.job.completed_at ? new Date(data.job.completed_at).toLocaleString() : 'Not completed'} />
                <DetailRow label="Failed" value={data.job.failed_at ? new Date(data.job.failed_at).toLocaleString() : 'Not failed'} />
                <DetailRow label="Last heartbeat" value={data.job.last_heartbeat_at ? new Date(data.job.last_heartbeat_at).toLocaleString() : 'No heartbeat'} />
              </dl>
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Diagnostics</h2>
              <div className="mt-4 rounded-2xl border border-border/70 bg-background/60 p-4 text-sm">
                <p className="font-medium text-foreground">
                  {data.job.status === 'cancelled'
                    ? 'Cancelled before completion.'
                    : data.job.failure_code
                      ? `${data.job.failure_code} during ${data.job.failure_stage || 'unknown'}`
                      : 'No provider failure recorded.'}
                </p>
                <p className="mt-2 leading-6 text-muted-foreground">
                  {data.job.error_message || (data.job.status === 'completed'
                    ? 'The linked generation completed successfully and attached result assets.'
                    : 'The job has not recorded an upstream/provider failure message yet.')}
                </p>
                {cancellation ? (
                  <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <DetailRow label="Cancel requested" value={cancellation.requestedAt ? new Date(cancellation.requestedAt).toLocaleString() : 'Unknown'} />
                    <DetailRow label="Cancelled at" value={cancellation.cancelledAt ? new Date(cancellation.cancelledAt).toLocaleString() : 'Unknown'} />
                    <DetailRow label="Requested by" value={cancellation.requestedBy || 'Unknown'} />
                    {cancellation.upstreamError ? (
                      <DetailRow label="Upstream cancel" value={cancellation.upstreamError} />
                    ) : null}
                  </dl>
                ) : null}
              </div>
            </section>

            {data.job.script ? (
              <section>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Script</h2>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{data.job.script}</p>
              </section>
            ) : null}

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Generation prompt</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {typeof inputs.prompt === 'string' ? inputs.prompt : data.job.brief}
              </p>
            </section>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Result assets</h2>
            <div className="mt-4 grid gap-4">
              {data.assets.length > 0 ? (
                data.assets.map((asset) => (
                  <div key={asset.id} className="rounded-2xl border border-border/70 bg-background/60 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">{asset.kind}</span>
                      <span className="text-xs text-muted-foreground">{new Date(asset.created_at).toLocaleString()}</span>
                    </div>
                    {asset.signedUrl ? (
                      asset.kind === 'VIDEO' ? (
                        <video src={asset.signedUrl} controls className="w-full rounded-xl" />
                      ) : (
                        <img src={asset.signedUrl} alt="Generated asset" className="w-full rounded-xl" />
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground">Asset available, signed URL not resolved yet.</p>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
                  No assets linked yet. If this job is still running, this panel will populate automatically when the generation job completes.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 break-all text-sm font-medium text-foreground">{value}</div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-all text-foreground">{value}</dd>
    </div>
  )
}
