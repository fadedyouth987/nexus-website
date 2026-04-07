'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Clapperboard, Image, Video, Filter, ArrowRight, X } from 'lucide-react'
import apiFetch from '@/lib/core/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type JobType = 'all' | 'image' | 'video'
type JobSource = 'all' | 'durable' | 'legacy'
type JobStatus = 'all' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

type UnifiedJob = {
  id: string
  source: 'durable' | 'legacy'
  job_kind?: 'video' | 'image'
  mode?: 'IMAGE' | 'VIDEO'
  title?: string
  prompt?: string
  status: string
  progress?: number
  retry_count?: number
  failure_code?: string | null
  error_message?: string | null
  created_at: string
  diagnostics?: {
    isStuck: boolean
    stuckReason: string | null
  }
}

const CANCELLABLE_STATUSES = new Set([
  'queued',
  'planning',
  'generating_assets',
  'rendering',
  'uploading',
  'QUEUED',
  'GENERATING',
])

const STATUS_MAPPING: Record<string, string> = {
  QUEUED: 'queued',
  GENERATING: 'running',
  READY: 'completed',
  FAILED: 'failed',
  CANCELED: 'cancelled',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
}

function normalizeStatus(status: string): string {
  return STATUS_MAPPING[status] || status.toLowerCase()
}

function getJobType(job: UnifiedJob): 'image' | 'video' {
  if (job.job_kind) return job.job_kind
  if (job.mode === 'VIDEO') return 'video'
  return 'image'
}

function getJobTitle(job: UnifiedJob): string {
  if (job.title) return job.title
  if (job.prompt) return job.prompt.slice(0, 80) + (job.prompt.length > 80 ? '...' : '')
  return `Generation ${job.id.slice(0, 8)}`
}

export function UnifiedGenerationList({
  initialJobs,
}: {
  initialJobs: UnifiedJob[]
}) {
  const router = useRouter()
  const [jobs, setJobs] = useState<UnifiedJob[]>(initialJobs)
  const [actionState, setActionState] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Filter states
  const [typeFilter, setTypeFilter] = useState<JobType>('all')
  const [sourceFilter, setSourceFilter] = useState<JobSource>('all')
  const [statusFilter, setStatusFilter] = useState<JobStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      // Type filter
      if (typeFilter !== 'all' && getJobType(job) !== typeFilter) {
        return false
      }

      // Source filter
      if (sourceFilter !== 'all' && job.source !== sourceFilter) {
        return false
      }

      // Status filter
      const normalizedStatus = normalizeStatus(job.status)
      if (statusFilter !== 'all' && normalizedStatus !== statusFilter) {
        return false
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const title = getJobTitle(job).toLowerCase()
        const id = job.id.toLowerCase()
        if (!title.includes(query) && !id.includes(query)) {
          return false
        }
      }

      return true
    })
  }, [jobs, typeFilter, sourceFilter, statusFilter, searchQuery])

  const stats = useMemo(() => {
    return {
      total: jobs.length,
      image: jobs.filter((j) => getJobType(j) === 'image').length,
      video: jobs.filter((j) => getJobType(j) === 'video').length,
      durable: jobs.filter((j) => j.source === 'durable').length,
      legacy: jobs.filter((j) => j.source === 'legacy').length,
      running: jobs.filter((j) => {
        const s = normalizeStatus(j.status)
        return s === 'queued' || s === 'running'
      }).length,
      completed: jobs.filter((j) => normalizeStatus(j.status) === 'completed').length,
      failed: jobs.filter((j) => normalizeStatus(j.status) === 'failed').length,
    }
  }, [jobs])

  const hasActiveFilters =
    typeFilter !== 'all' || sourceFilter !== 'all' || statusFilter !== 'all' || searchQuery !== ''

  function clearFilters() {
    setTypeFilter('all')
    setSourceFilter('all')
    setStatusFilter('all')
    setSearchQuery('')
  }

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
    router.refresh()
    return payload
  }

  async function handleCancel(jobId: string) {
    if (!window.confirm('Cancel this generation job? This is best-effort once generation has started.')) {
      return
    }
    await runAction(jobId, 'cancel')
  }

  async function handleRetry(jobId: string) {
    await runAction(jobId, 'retry')
  }

  async function handleDuplicate(jobId: string) {
    const payload = await runAction(jobId, 'duplicate')
    if (payload) {
      const nextId = (payload as { job?: { id?: string }; id?: string }).job?.id || (payload as { id?: string }).id
      if (nextId) {
        router.push(`/video-jobs/${nextId}`)
      }
    }
  }

  function getStatusBadgeColor(status: string) {
    const s = normalizeStatus(status)
    switch (s) {
      case 'completed':
        return 'bg-green-500/10 text-green-600 border-green-500/20'
      case 'failed':
        return 'bg-red-500/10 text-red-600 border-red-500/20'
      case 'cancelled':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
      case 'running':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      case 'queued':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              <Clapperboard className="h-3.5 w-3.5" />
              Generation Jobs
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Unified view of all generation jobs.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Track image and video generation jobs, monitor progress, cancel stuck jobs, retry failures, and run proven jobs again.
            </p>
          </div>
          <Button asChild className="shrink-0 gap-2">
            <Link href="/studio">
              New generation
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Image" value={stats.image} icon={<Image className="h-3 w-3" />} />
          <StatCard label="Video" value={stats.video} icon={<Video className="h-3 w-3" />} />
          <StatCard label="Running" value={stats.running} highlight />
          <StatCard label="Completed" value={stats.completed} />
          <StatCard label="Failed" value={stats.failed} danger={stats.failed > 0} />
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Input
              placeholder="Search by title or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as JobType)}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as JobSource)}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="durable">Campaign Jobs</SelectItem>
                <SelectItem value="legacy">Legacy</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as JobStatus)}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1">
                <X className="h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Results count */}
        <div className="mt-4 text-xs text-muted-foreground">
          Showing {filteredJobs.length} of {jobs.length} jobs
          {hasActiveFilters && ' (filtered)'}
        </div>

        {/* Error */}
        {actionError ? (
          <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        ) : null}

        {/* Job List */}
        <div className="mt-4 grid gap-3">
          {filteredJobs.length > 0 ? (
            filteredJobs.map((job) => {
              const actionKeyPrefix = `${job.id}:`
              const jobType = getJobType(job)
              const normalizedStatus = normalizeStatus(job.status)
              const isCancellable = CANCELLABLE_STATUSES.has(job.status)
              const isFailed = normalizedStatus === 'failed'
              const isLegacy = job.source === 'legacy'

              return (
                <div
                  key={job.id}
                  className="rounded-2xl border border-border/70 bg-background/70 p-4 transition-colors hover:border-border"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      {/* Title row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold tracking-tight text-foreground">
                          {getJobTitle(job)}
                        </h2>
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                          {jobType === 'video' ? (
                            <Video className="mr-1 h-3 w-3" />
                          ) : (
                            <Image className="mr-1 h-3 w-3" />
                          )}
                          {jobType}
                        </Badge>
                        <Badge variant="outline" className={getStatusBadgeColor(job.status)}>
                          {normalizedStatus}
                          {job.progress !== undefined && job.progress > 0 && job.progress < 100
                            ? ` ${job.progress}%`
                            : null}
                        </Badge>
                        {isLegacy && (
                          <Badge variant="outline" className="text-[10px]">
                            Legacy
                          </Badge>
                        )}
                        {job.diagnostics?.isStuck && (
                          <Badge
                            variant="outline"
                            className="border-amber-400/30 bg-amber-400/10 text-amber-900 dark:text-amber-200"
                          >
                            Stuck
                          </Badge>
                        )}
                        {job.retry_count ? (
                          <Badge variant="outline" className="text-[10px]">
                            Retry {job.retry_count}
                          </Badge>
                        ) : null}
                      </div>

                      {/* ID and date */}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {job.id} · {new Date(job.created_at).toLocaleString()}
                      </p>

                      {/* Error info */}
                      {(job.failure_code || job.error_message || job.diagnostics?.stuckReason) && (
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {[job.failure_code, job.error_message, job.diagnostics?.stuckReason]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}

                      {/* Actions */}
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        <Link
                          href={isLegacy ? `/generations/${job.id}` : `/video-jobs/${job.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          Open
                        </Link>
                        {!isLegacy && (
                          <Link
                            href={`/video-jobs/${job.id}/edit`}
                            className="font-medium text-muted-foreground hover:text-foreground hover:underline"
                          >
                            Edit
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {!isLegacy && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => void handleDuplicate(job.id)}
                          disabled={actionState !== null}
                          variant="outline"
                          size="sm"
                        >
                          {actionState === `${actionKeyPrefix}duplicate` ? 'Starting...' : 'Run again'}
                        </Button>
                        {isFailed && (
                          <Button
                            onClick={() => void handleRetry(job.id)}
                            disabled={actionState !== null}
                            size="sm"
                          >
                            {actionState === `${actionKeyPrefix}retry` ? 'Retrying...' : 'Retry'}
                          </Button>
                        )}
                        {isCancellable && (
                          <Button
                            onClick={() => void handleCancel(job.id)}
                            disabled={actionState !== null}
                            variant="outline"
                            size="sm"
                          >
                            {actionState === `${actionKeyPrefix}cancel` ? 'Cancelling...' : 'Cancel'}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? 'No jobs match your filters. Try adjusting or clearing filters.'
                  : 'No generation jobs yet. Create your first generation in Studio.'}
              </p>
              {!hasActiveFilters && (
                <Button asChild className="mt-4" size="sm">
                  <Link href="/studio">Go to Studio</Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatCard({
  label,
  value,
  icon,
  highlight,
  danger,
}: {
  label: string
  value: number
  icon?: React.ReactNode
  highlight?: boolean
  danger?: boolean
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-center ${
        highlight
          ? 'border-primary/20 bg-primary/5'
          : danger
            ? 'border-red-500/20 bg-red-500/5'
            : 'border-border/70 bg-muted/30'
      }`}
    >
      <div className="text-2xl font-semibold tabular-nums tracking-tight">
        {icon ? <span className="mr-1 inline-flex items-center">{icon}</span> : null}
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}
