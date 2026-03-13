import type { VideoJobRecord } from './types'

const ACTIVE_STATUSES = new Set(['queued', 'planning', 'generating_assets', 'rendering', 'uploading'])
const CANCELLABLE_STATUSES = new Set(['queued', 'planning', 'generating_assets', 'rendering', 'uploading'])
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled'])
const QUEUED_STUCK_MS = 10 * 60 * 1000
const HEARTBEAT_STALE_MS = 3 * 60 * 1000

export function isActiveVideoJobStatus(status: VideoJobRecord['status']) {
  return ACTIVE_STATUSES.has(status)
}

export function isCancellableVideoJobStatus(status: VideoJobRecord['status']) {
  return CANCELLABLE_STATUSES.has(status)
}

export function isTerminalVideoJobStatus(status: VideoJobRecord['status']) {
  return TERMINAL_STATUSES.has(status)
}

export function deriveVideoJobDiagnostics(job: VideoJobRecord, now = new Date()) {
  const nowMs = now.getTime()
  const baselineMs = Date.parse(job.last_heartbeat_at || job.updated_at || job.created_at)
  const heartbeatMs = job.last_heartbeat_at ? Date.parse(job.last_heartbeat_at) : null

  const isQueuedTooLong =
    job.status === 'queued' &&
    Number.isFinite(baselineMs) &&
    nowMs - baselineMs > QUEUED_STUCK_MS

  const hasStaleHeartbeat =
    isActiveVideoJobStatus(job.status) &&
    heartbeatMs != null &&
    Number.isFinite(heartbeatMs) &&
    nowMs - heartbeatMs > HEARTBEAT_STALE_MS

  const isStuck = isQueuedTooLong || hasStaleHeartbeat

  const stuckReason = isQueuedTooLong
    ? 'Queued too long without starting.'
    : hasStaleHeartbeat
      ? 'Heartbeat is stale. Worker progress may be stuck.'
      : null

  return {
    isActive: isActiveVideoJobStatus(job.status),
    isStuck,
    isQueuedTooLong,
    hasStaleHeartbeat,
    stuckReason,
  }
}
