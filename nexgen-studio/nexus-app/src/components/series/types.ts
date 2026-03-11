export type SeriesInfluencer = {
  id: string
  name?: string | null
  display_name?: string | null
  handle?: string | null
}

export type SeriesProject = {
  id: string
  title: string
  theme: string
  status: string
  episode_count: number
  influencer_id: string
  created_at: string
  workspace_id?: string | null
}

export type SeriesEpisode = {
  id: string
  series_id: string
  episode_index: number
  status: string
  title: string | null
  generated_asset_id: string | null
  queue_job_id: string | null
}
