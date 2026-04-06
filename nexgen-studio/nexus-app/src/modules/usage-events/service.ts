import type { AppSession } from '@/server/auth/session'
import { createApiError } from '@/server/api/route'
import { deriveVideoJobDiagnostics } from '@/modules/video-jobs/diagnostics'
import { listVideoJobs } from '@/modules/video-jobs/repository'
import { listUsageEvents, upsertUsageEvent } from './repository'
import type { CreateUsageEventInput, GenerationUsageMetrics, UsageEventName } from './types'

export async function recordUsageEvent(input: CreateUsageEventInput) {
  return upsertUsageEvent(input)
}

function normalizeDateRange(from?: string | null, to?: string | null) {
  const end = to ? new Date(to) : new Date()
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw createApiError(400, 'Invalid analytics date range')
  }

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  }
}

function average(values: number[]) {
  if (values.length === 0) {
    return null
  }
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
}

export async function getGenerationUsageMetrics(
  session: AppSession,
  options?: { from?: string | null; to?: string | null }
) {
  const { from, to } = normalizeDateRange(options?.from, options?.to)

  const [jobs, usageEvents] = await Promise.all([
    listVideoJobs(session),
    listUsageEvents(session, from, to),
  ])

  const scopedJobs = jobs.filter((job) => job.created_at >= from && job.created_at <= to)

  const completionsByKind = {
    image: [] as number[],
    video: [] as number[],
  }

  const byKind = {
    image: { total: 0, completed: 0, failed: 0, cancelled: 0 },
    video: { total: 0, completed: 0, failed: 0, cancelled: 0 },
  }

  let completedJobs = 0
  let failedJobs = 0
  let cancelledJobs = 0
  let retryingJobs = 0
  let stuckJobs = 0

  for (const job of scopedJobs) {
    byKind[job.job_kind].total += 1

    if (job.retry_count > 0) {
      retryingJobs += 1
    }

    if (deriveVideoJobDiagnostics(job).isStuck) {
      stuckJobs += 1
    }

    if (job.status === 'completed') {
      completedJobs += 1
      byKind[job.job_kind].completed += 1
      if (job.started_at && job.completed_at) {
        const durationSeconds = (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000
        if (Number.isFinite(durationSeconds) && durationSeconds >= 0) {
          completionsByKind[job.job_kind].push(durationSeconds)
        }
      }
    } else if (job.status === 'failed') {
      failedJobs += 1
      byKind[job.job_kind].failed += 1
    } else if (job.status === 'cancelled') {
      cancelledJobs += 1
      byKind[job.job_kind].cancelled += 1
    }
  }

  const usageEventSummary = new Map<UsageEventName, { count: number; units: number }>()
  let reservedCredits = 0
  let finalizedCredits = 0
  let releasedCredits = 0

  for (const event of usageEvents) {
    const current = usageEventSummary.get(event.event_name) || { count: 0, units: 0 }
    current.count += 1
    current.units += Number(event.units || 0)
    usageEventSummary.set(event.event_name, current)

    if (event.event_name === 'credits_reserved') {
      reservedCredits += Number(event.units || 0)
    } else if (event.event_name === 'usage_finalized') {
      finalizedCredits += Number(event.units || 0)
    } else if (event.event_name === 'credits_released') {
      releasedCredits += Number(event.units || 0)
    }
  }

  const averageCompletionSeconds = average([
    ...completionsByKind.image,
    ...completionsByKind.video,
  ])

  const metrics: GenerationUsageMetrics = {
    totals: {
      totalJobs: scopedJobs.length,
      imageJobs: byKind.image.total,
      videoJobs: byKind.video.total,
      completedJobs,
      failedJobs,
      cancelledJobs,
      retryingJobs,
      retryRate: scopedJobs.length > 0 ? Math.round((retryingJobs / scopedJobs.length) * 1000) / 1000 : 0,
      averageCompletionSeconds,
      stuckJobs,
      finalizedCredits,
      releasedCredits,
      reservedCredits,
    },
    byKind: [
      {
        jobKind: 'image',
        ...byKind.image,
        averageCompletionSeconds: average(completionsByKind.image),
      },
      {
        jobKind: 'video',
        ...byKind.video,
        averageCompletionSeconds: average(completionsByKind.video),
      },
    ],
    usageEvents: Array.from(usageEventSummary.entries())
      .map(([eventName, value]) => ({
        eventName,
        count: value.count,
        units: Math.round(value.units * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count),
  }

  return {
    metrics,
    meta: {
      from,
      to,
      orgId: session.orgId,
    },
  }
}
