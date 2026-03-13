import type { VideoJobStatus } from '@/types/video-jobs'
export type { VideoJobStatus } from '@/types/video-jobs'

export type VideoJobFailureStage =
  | 'planning'
  | 'generating_assets'
  | 'rendering'
  | 'uploading'
  | 'provider_sync'
  | 'validation'
  | 'unknown'

export type VideoJobFailureCode =
  | 'missing_workflow_template'
  | 'missing_influencer'
  | 'missing_required_context'
  | 'underlying_generation_failed'
  | 'underlying_generation_timeout'
  | 'asset_persistence_failed'
  | 'invalid_job_state'
  | 'unknown_error'
  | 'provider_cancelled'
  | 'provider_rate_limited'
  | 'provider_unavailable'
  | 'provider_auth_failed'
  | 'provider_invalid_request'
  | 'provider_timeout'
  | 'upstream_job_missing'
  | 'upstream_job_terminal_failed'
  | 'upstream_asset_missing'
  | 'upstream_result_invalid'
  | 'cancellation_requested'
  | 'cancellation_completed'

export type VideoJobRecord = {
  id: string
  org_id: string
  job_kind: 'video' | 'image'
  project_id: string | null
  campaign_id: string | null
  brand_kit_id: string | null
  scheduled_content_run_id: string | null
  scheduled_content_run_execution_id: string | null
  source_generation_job_id: string | null
  title: string
  brief: string
  script: string | null
  provider: string
  provider_job_id: string | null
  status: VideoJobStatus
  progress: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  failed_at: string | null
  last_heartbeat_at: string | null
  retry_count: number
  failure_stage: VideoJobFailureStage | null
  failure_code: VideoJobFailureCode | null
  created_by: string
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
}

export type CreateVideoJobInput = {
  jobKind?: 'video' | 'image'
  projectId?: string
  campaignId?: string
  brandKitId?: string
  scheduledContentRunId?: string
  scheduledContentRunExecutionId?: string
  title: string
  brief: string
  script?: string
  provider?: string
  influencerId?: string
  workflowTemplateId?: string
  inputs?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export type VideoJobDetail = {
  job: VideoJobRecord
  assets: Array<{
    id: string
    kind: string
    storage_url: string | null
    created_at: string
  }>
}

export type VideoJobWithDiagnostics = VideoJobRecord & {
  diagnostics: {
    isActive: boolean
    isStuck: boolean
    isQueuedTooLong: boolean
    hasStaleHeartbeat: boolean
    stuckReason: string | null
  }
}
