export const VIDEO_JOB_STATUSES = [
  'queued',
  'planning',
  'generating_assets',
  'rendering',
  'uploading',
  'completed',
  'failed',
  'cancelled',
] as const

export type VideoJobStatus = (typeof VIDEO_JOB_STATUSES)[number]
