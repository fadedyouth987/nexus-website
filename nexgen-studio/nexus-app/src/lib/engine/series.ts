export async function loadOwnedSeries(admin: any, userId: string, seriesId: string) {
  const { data: series, error } = await admin
    .from('series_projects')
    .select('id, user_id, organization_id, influencer_id, title, theme, episode_count, status')
    .eq('id', seriesId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to load series')
  }

  if (!series) {
    const notFound = new Error('Series not found') as Error & { status?: number }
    notFound.status = 404
    throw notFound
  }

  return series
}

export async function nextEpisodeIndex(admin: any, seriesId: string) {
  const { data, error } = await admin
    .from('series_episodes')
    .select('episode_index')
    .eq('series_id', seriesId)
    .order('episode_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message || 'Failed to resolve next episode index')
  }

  if (!data?.episode_index || typeof data.episode_index !== 'number') {
    return 1
  }

  return data.episode_index + 1
}
