export type UsageEventName =
  | 'job_queued'
  | 'job_retried'
  | 'job_rerun'
  | 'credits_reserved'
  | 'job_completed'
  | 'usage_finalized'
  | 'job_failed'
  | 'job_cancelled'
  | 'credits_released'

export type UsageUnitType = 'credits' | 'count'

export type UsageEventRecord = {
  id: string
  org_id: string
  user_id: string | null
  project_id: string | null
  campaign_id: string | null
  video_job_id: string | null
  generation_job_id: string | null
  workflow_template_id: string | null
  event_name: UsageEventName
  job_kind: 'image' | 'video' | null
  provider: string | null
  units: number
  unit_type: UsageUnitType
  event_key: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type CreateUsageEventInput = {
  eventKey: string
  orgId: string
  userId?: string | null
  projectId?: string | null
  campaignId?: string | null
  videoJobId?: string | null
  generationJobId?: string | null
  workflowTemplateId?: string | null
  eventName: UsageEventName
  jobKind?: 'image' | 'video' | null
  provider?: string | null
  units?: number
  unitType?: UsageUnitType
  metadata?: Record<string, unknown>
}

export type GenerationUsageMetrics = {
  totals: {
    totalJobs: number
    imageJobs: number
    videoJobs: number
    completedJobs: number
    failedJobs: number
    cancelledJobs: number
    retryingJobs: number
    retryRate: number
    averageCompletionSeconds: number | null
    stuckJobs: number
    finalizedCredits: number
    releasedCredits: number
    reservedCredits: number
  }
  byKind: Array<{
    jobKind: 'image' | 'video'
    total: number
    completed: number
    failed: number
    cancelled: number
    averageCompletionSeconds: number | null
  }>
  usageEvents: Array<{
    eventName: UsageEventName
    count: number
    units: number
  }>
}
