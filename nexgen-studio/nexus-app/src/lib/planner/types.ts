/** Brief extracted from user chat (plan_briefs columns). */
export interface PlanBriefInput {
  niche?: string
  tone?: string
  audience_json?: string[]
  platforms_json?: string[]
  posting_frequency_json?: Record<string, unknown>
  monetization_goal?: string
  visual_style?: string
  constraints_json?: Record<string, unknown>
}

/** Strategy profile (strategy_profiles columns). */
export interface StrategyProfileInput {
  content_pillars_json?: string[]
  funnel_stages_json?: string[]
  weekly_rhythm_json?: Record<string, string>
  cta_rules_json?: Record<string, string>
  brand_rules_json?: Record<string, unknown>
}

/** Single content item for 30-day calendar (content_items row). */
export interface ContentItemInput {
  day_number: number
  publish_date?: string
  platform?: string
  slot_number?: number
  content_pillar?: string
  funnel_stage?: string
  post_type?: string
  title?: string
  hook?: string
  angle?: string
  caption_direction?: string
  cta?: string
  prompt_seed?: string
  status?: 'draft' | 'approved' | 'scheduled'
}

export const PLANNER_STAGES = [
  'brief_intake',
  'strategy_synthesis',
  'calendar_generation',
  'calendar_review',
  'asset_preparation',
  'scheduling',
  'optimization',
] as const

export type PlannerStage = (typeof PLANNER_STAGES)[number]
