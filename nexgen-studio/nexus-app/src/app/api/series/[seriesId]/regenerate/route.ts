import { NextResponse } from 'next/server'
import { getEngineUser } from '@/lib/engine/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { ENGINE_SERIES_JOB, ENGINE_SERIES_QUEUE, enqueueEngineJob } from '@/lib/engine/queue'
import { loadOwnedSeries } from '@/lib/engine/series'

export async function POST(
  request: Request,
  context: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { authUserId } = await getEngineUser(request)
    const admin = getEngineSupabaseAdmin()
    const { seriesId } = await context.params
    await loadOwnedSeries(admin, authUserId, seriesId)

    const { data: episodes, error } = await admin
      .from('series_episodes')
      .select('id')
      .eq('series_id', seriesId)
      .order('episode_index', { ascending: true })

    if (error) {
      return NextResponse.json(
        { detail: error.message || 'Failed to load series episodes' },
        { status: 500 }
      )
    }

    const rows = Array.isArray(episodes) ? episodes : []
    let queuedCount = 0
    let failedCount = 0

    for (const episode of rows) {
      try {
        const queueJobId = await enqueueEngineJob({
          queueName: ENGINE_SERIES_QUEUE,
          jobName: ENGINE_SERIES_JOB,
          payload: {
            kind: 'series_episode',
            seriesEpisodeId: String(episode.id),
          },
        })

        await admin
          .from('series_episodes')
          .update({
            status: 'QUEUED',
            queue_job_id: queueJobId,
            error: null,
          })
          .eq('id', episode.id)

        queuedCount += 1
      } catch {
        failedCount += 1
      }
    }

    await admin
      .from('series_projects')
      .update({
        status: queuedCount > 0 ? 'RUNNING' : 'FAILED',
        completed_at: queuedCount > 0 ? null : new Date().toISOString(),
      })
      .eq('id', seriesId)

    return NextResponse.json({
      ok: true,
      seriesId,
      queuedEpisodes: queuedCount,
      failedEpisodes: failedCount,
    })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to regenerate series' },
      { status }
    )
  }
}
