import { NextResponse } from 'next/server'
import { getEngineUser } from '@/lib/engine/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { ENGINE_SERIES_JOB, ENGINE_SERIES_QUEUE, enqueueEngineJob } from '@/lib/engine/queue'
import { createContentPlanRow } from '@/lib/engine/createContentPlanRow'
import { createQueueItemRow } from '@/lib/engine/createQueueItemRow'
import { loadOwnedSeries, nextEpisodeIndex } from '@/lib/engine/series'

type AddEpisodeBody = {
  title?: string
  prompt?: string
}

function parseBody(value: unknown): AddEpisodeBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const body = value as Record<string, unknown>
  return {
    title: typeof body.title === 'string' ? body.title.trim() : undefined,
    prompt: typeof body.prompt === 'string' ? body.prompt.trim() : undefined,
  }
}

function buildDefaultTitle(seriesTitle: string, episodeIndex: number) {
  return `${seriesTitle} - Episode ${episodeIndex}`
}

function buildDefaultPrompt(theme: string, seriesTitle: string, episodeIndex: number) {
  return `Generate visual key art for ${seriesTitle} episode ${episodeIndex}. Theme: ${theme}.`
}

export async function POST(
  request: Request,
  context: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { authUserId } = await getEngineUser(request)
    const admin = getEngineSupabaseAdmin()
    const { seriesId } = await context.params
    const series = await loadOwnedSeries(admin, authUserId, seriesId)

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      raw = {}
    }
    const body = parseBody(raw)

    const episodeIndex = await nextEpisodeIndex(admin, seriesId)
    const title = body.title || buildDefaultTitle(series.title, episodeIndex)
    const prompt = body.prompt || buildDefaultPrompt(series.theme, series.title, episodeIndex)

    const contentPlan = await createContentPlanRow({
      admin,
      influencerId: series.influencer_id,
      orgId: series.organization_id,
      theme: title,
      notes: prompt,
      date: new Date().toISOString().slice(0, 10),
    })

    const queueItem = await createQueueItemRow({
      admin,
      table: 'series_episodes',
      parentColumn: 'series_id',
      parentId: seriesId,
      indexColumn: 'episode_index',
      indexValue: episodeIndex,
      title,
      prompt,
      contentPlanId: contentPlan.id,
    })

    const queueJobId = await enqueueEngineJob({
      queueName: ENGINE_SERIES_QUEUE,
      jobName: ENGINE_SERIES_JOB,
      payload: {
        kind: 'series_episode',
        seriesEpisodeId: queueItem.id,
      },
    })

    await admin
      .from('series_episodes')
      .update({ queue_job_id: queueJobId, status: 'QUEUED', error: null })
      .eq('id', queueItem.id)

    await admin
      .from('series_projects')
      .update({
        episode_count: episodeIndex,
        status: 'RUNNING',
        completed_at: null,
      })
      .eq('id', seriesId)

    return NextResponse.json(
      {
        ok: true,
        episodeId: queueItem.id,
        episodeIndex,
        queueJobId,
      },
      { status: 201 }
    )
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to add episode' },
      { status }
    )
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { authUserId } = await getEngineUser(request)
    const admin = getEngineSupabaseAdmin()
    const { seriesId } = await context.params

    let useLegacySeriesTable = false
    const { data: series, error: seriesError } = await admin
      .from('series_projects')
      .select('id')
      .eq('id', seriesId)
      .eq('user_id', authUserId)
      .maybeSingle()

    if (seriesError) {
      if (seriesError.code === '42P01') {
        useLegacySeriesTable = true
      } else {
        return NextResponse.json({ detail: seriesError.message || 'Failed to load series' }, { status: 500 })
      }
    }

    if (!useLegacySeriesTable && !series) {
      return NextResponse.json({ detail: 'Series not found' }, { status: 404 })
    }

    if (useLegacySeriesTable) {
      const { data: legacySeries, error: legacySeriesError } = await admin
        .from('series')
        .select('id')
        .eq('id', seriesId)
        .eq('user_id', authUserId)
        .maybeSingle()

      if (legacySeriesError) {
        return NextResponse.json(
          { detail: legacySeriesError.message || 'Failed to load series' },
          { status: 500 }
        )
      }

      if (!legacySeries) {
        return NextResponse.json({ detail: 'Series not found' }, { status: 404 })
      }
    }

    const { data, error } = await admin
      .from('series_episodes')
      .select('id, series_id, episode_index, status, title, generated_asset_id, queue_job_id')
      .eq('series_id', seriesId)
      .order('episode_index', { ascending: true })

    if (error) {
      if (error.code === '42P01') {
        const { data: legacyData, error: legacyError } = await admin
          .from('series_episode')
          .select('*')
          .eq('series_id', seriesId)
          .order('episode_index', { ascending: true })

        if (legacyError) {
          return NextResponse.json(
            { detail: legacyError.message || 'Failed to load episodes' },
            { status: 500 }
          )
        }

        const normalized = (legacyData ?? []).map((row: any) => ({
          id: row.id,
          series_id: row.series_id,
          episode_index: row.episode_index,
          status: row.status,
          title: row.title || null,
          generated_asset_id: row.generated_asset_id || row.asset_id || null,
          queue_job_id: row.queue_job_id || row.job_id || null,
        }))

        return NextResponse.json({ items: normalized })
      }

      return NextResponse.json({ detail: error.message || 'Failed to load episodes' }, { status: 500 })
    }

    return NextResponse.json({ items: data ?? [] })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load episodes' },
      { status }
    )
  }
}
