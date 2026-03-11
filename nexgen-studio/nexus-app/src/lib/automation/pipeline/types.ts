import type { ContentItemInput, PlanBriefInput } from '@/lib/planner/types'

export type FactoryPersonaInput = {
  name?: string
  niche?: string
  personality?: string
  speech_style?: string
  catchphrases?: string[]
  posting_frequency?: number
  monetization_strategy?: string
  audience_type?: string
  tone?: string
  platforms?: string[]
  content_rating?: 'sfw' | 'nsfw'
  model_source?: 'builtin' | 'custom'
  custom_model_source?: string
}

export type FactoryPayload = {
  persona?: FactoryPersonaInput
}

export type CreatorMode = 'legacy' | 'v2' | 'none'

export type CreatorResult = {
  id: string
  mode: CreatorMode
  orgId?: string
  workspaceId?: string
}

export type SchedulerQueueResult = {
  queuedContent: number
  queuedSchedules: number
}

export type PipelineStepStatus = 'completed' | 'skipped'

export type PipelineStepReport<TContext> = {
  name: string
  status: PipelineStepStatus
  context: TContext
}

export interface PipelineStep<TContext> {
  name: string
  enabled?: (context: TContext) => boolean
  execute: (context: TContext) => Promise<Partial<TContext> | void>
}

export type PipelineRunResult<TContext> = {
  context: TContext
  reports: Array<PipelineStepReport<TContext>>
}

export type InfluencerPipelineContext = {
  userId: string
  persona: FactoryPersonaInput
  creator: CreatorResult | null
  planId: string | null
  brief: PlanBriefInput | null
  strategy: Record<string, unknown> | null
  contentItems: ContentItemInput[]
  schedulerQueue: SchedulerQueueResult | null
  monetizationOfferId: string | null
}
