import type { VideoJobStatus } from '@/types/video-jobs'

const GENERATION_STATUS_MAP: Record<string, { status: VideoJobStatus; progress: number }> = {
  PENDING: { status: 'queued', progress: 5 },
  QUEUED: { status: 'queued', progress: 10 },
  GENERATING: { status: 'rendering', progress: 55 },
  RUNNING: { status: 'generating_assets', progress: 45 },
  READY: { status: 'completed', progress: 100 },
  SUCCEEDED: { status: 'completed', progress: 100 },
  FAILED: { status: 'failed', progress: 100 },
  CANCELED: { status: 'cancelled', progress: 100 },
}

export function mapGenerationStatusToVideoLifecycle(status: string | null | undefined) {
  return GENERATION_STATUS_MAP[status ?? ''] || { status: 'planning' as const, progress: 20 }
}
