export type WorkspaceRow = {
  id: string
  name: string
}

export type WorkspaceMetricsRow = {
  workspace_id: string
  workspace_name: string
  total_posts: number
  total_generated_assets: number
  engagement_total: number
  plan_count: number
  plan_completed_count: number
}

export type CreatorMetricsRow = {
  creator_id: string
  workspace_id: string
  creator_name: string
  total_posts: number
  total_generated_assets: number
  engagement_total: number
  plan_count: number
  plan_completed_count: number
}

export type PerformancePoint = {
  workspace_id: string
  day: string
  views: number
  engagement: number
  revenue: number
}
