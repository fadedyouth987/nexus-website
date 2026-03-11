import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { SeriesPageClient } from '@/components/series/SeriesPageClient'
import type { SeriesEpisode, SeriesInfluencer, SeriesProject } from '@/components/series/types'

export default async function SeriesPage() {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const [{ data: influencers }, { data: series }, { data: episodes }] = await Promise.all([
    supabase
      .from('influencers')
      .select('id, name, display_name, handle')
      .order('created_at', { ascending: false }),
    supabase
      .from('series_projects')
      .select('id, title, theme, status, episode_count, influencer_id, created_at, workspace_id')
      .order('created_at', { ascending: false }),
    supabase
      .from('series_episodes')
      .select('id, series_id, episode_index, status, title, generated_asset_id, queue_job_id')
      .order('created_at', { ascending: false }),
  ])

  const firstSeries = (series as SeriesProject[] | null)?.[0] || null
  const workspaceId = firstSeries?.workspace_id || null

  return (
    <SeriesPageClient
      initialInfluencers={(influencers || []) as SeriesInfluencer[]}
      initialSeries={(series || []) as SeriesProject[]}
      initialEpisodes={(episodes || []) as SeriesEpisode[]}
      workspaceId={workspaceId}
    />
  )
}
