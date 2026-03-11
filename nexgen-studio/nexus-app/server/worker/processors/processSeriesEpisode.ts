import { getWorkerSupabaseAdmin } from '../core/supabaseAdmin'
import { runManagedImageGeneration } from '../engines/engineGeneration'

type SeriesEpisodePayload = {
  kind: 'series_episode'
  seriesEpisodeId: string
}

async function refreshSeriesStatus(admin: any, seriesId: string) {
  const { data: episodes } = await admin
    .from('series_episodes')
    .select('status')
    .eq('series_id', seriesId)

  const rows = Array.isArray(episodes) ? episodes : []
  const total = rows.length
  const ready = rows.filter((row) => row.status === 'READY').length
  const failed = rows.filter((row) => row.status === 'FAILED').length

  let status = 'RUNNING'
  let completedAt: string | null = null
  if (total > 0 && ready === total) {
    status = 'COMPLETED'
    completedAt = new Date().toISOString()
  } else if (total > 0 && failed === total) {
    status = 'FAILED'
    completedAt = new Date().toISOString()
  }

  await admin
    .from('series_projects')
    .update({
      status,
      completed_at: completedAt,
    })
    .eq('id', seriesId)
}

export async function processSeriesEpisode(payload: SeriesEpisodePayload) {
  const admin = getWorkerSupabaseAdmin()

  const { data: episode } = await admin
    .from('series_episodes')
    .select(
      'id, series_id, episode_index, status, title, prompt, content_plan_id, generation_job_id, generated_asset_id'
    )
    .eq('id', payload.seriesEpisodeId)
    .maybeSingle()

  if (!episode) {
    throw new Error(`Series episode not found: ${payload.seriesEpisodeId}`)
  }

  if (episode.status === 'READY') {
    return { ok: true, skipped: true, reason: 'already_ready' }
  }

  const { data: series } = await admin
    .from('series_projects')
    .select('id, user_id, organization_id, influencer_id, title, theme')
    .eq('id', episode.series_id)
    .maybeSingle()

  if (!series) {
    throw new Error(`Series project not found for episode ${episode.id}`)
  }

  const prompt =
    (typeof episode.prompt === 'string' && episode.prompt.trim()) ||
    `Generate visual key art for ${series.title}, episode ${episode.episode_index}. Theme: ${series.theme}.`

  await admin
    .from('series_episodes')
    .update({
      status: 'GENERATING',
      error: null,
      progress_json: {
        status: 'running',
        message: 'Submitting generation job',
        updatedAt: new Date().toISOString(),
      },
    })
    .eq('id', episode.id)

  try {
    const generation = await runManagedImageGeneration({
      admin,
      userId: series.user_id,
      organizationId: series.organization_id,
      influencerId: series.influencer_id,
      prompt,
      source: 'worker.series_episode',
    })

    await admin
      .from('series_episodes')
      .update({
        status: 'READY',
        generation_job_id: generation.jobId,
        generated_asset_id: generation.assetId,
        progress_json: {
          status: 'ready',
          percent: 100,
          message: 'Complete',
          updatedAt: new Date().toISOString(),
        },
        error: null,
      })
      .eq('id', episode.id)

    if (episode.content_plan_id) {
      await admin
        .from('content_plans')
        .update({
          notes: `${prompt}\n\nGenerated asset: ${generation.assetId || 'n/a'}`,
        })
        .eq('id', episode.content_plan_id)
    }

    await refreshSeriesStatus(admin, series.id)
    return { ok: true, generationJobId: generation.jobId, assetId: generation.assetId }
  } catch (error) {
    await admin
      .from('series_episodes')
      .update({
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Series generation failed',
        progress_json: {
          status: 'failed',
          message: error instanceof Error ? error.message : 'Series generation failed',
          updatedAt: new Date().toISOString(),
        },
      })
      .eq('id', episode.id)

    await refreshSeriesStatus(admin, series.id)
    throw error
  }
}
