export type ScheduledContentRunStatus =
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'failed'
  | 'completed'

export type ScheduledContentRunFrequency = 'daily' | 'weekly'

export type ScheduledContentRunRecord = {
  id: string
  org_id: string
  project_id: string | null
  brand_kit_id: string | null
  campaign_id: string | null
  workflow_template_id: string | null
  influencer_id: string | null
  schedule_key: string
  title: string
  brief: string
  script: string | null
  frequency: ScheduledContentRunFrequency
  status: ScheduledContentRunStatus
  provider: string
  job_kind: 'image' | 'video'
  jobs_per_run: number
  day_of_week: number | null
  time_of_day: string
  timezone: string
  next_run_at: string | null
  last_run_at: string | null
  last_success_at: string | null
  last_failure_at: string | null
  last_error_message: string | null
  metadata: Record<string, unknown>
  created_by: string
  created_at: string
  updated_at: string
}

export type ScheduledContentRunExecutionRecord = {
  id: string
  scheduled_content_run_id: string
  org_id: string
  trigger_type: 'recurrence' | 'manual'
  scheduled_for: string
  status: 'running' | 'completed' | 'failed'
  jobs_requested: number
  jobs_created: number
  started_at: string
  completed_at: string | null
  failed_at: string | null
  error_message: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type ScheduledContentRunJobSummary = {
  id: string
  title: string
  job_kind: 'image' | 'video'
  status: string
  progress: number
  created_at: string
  scheduled_content_run_execution_id: string | null
}

export type ScheduledContentRunDetail = {
  schedule: ScheduledContentRunRecord
  executions: ScheduledContentRunExecutionRecord[]
  jobs: ScheduledContentRunJobSummary[]
}

export type CreateScheduledContentRunInput = {
  projectId?: string
  brandKitId?: string
  campaignId?: string
  workflowTemplateId?: string
  influencerId?: string
  title: string
  brief: string
  script?: string
  frequency: ScheduledContentRunFrequency
  dayOfWeek?: number
  timeOfDay: string
  timezone: string
  jobsPerRun?: number
  provider?: string
  jobKind: 'image' | 'video'
  inputs?: Record<string, unknown>
}

export type UpdateScheduledContentRunInput = Partial<CreateScheduledContentRunInput> & {
  title: string
  brief: string
  frequency: ScheduledContentRunFrequency
  timeOfDay: string
  timezone: string
  jobKind: 'image' | 'video'
}
