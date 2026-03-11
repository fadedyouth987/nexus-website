import { NextResponse } from 'next/server'
import { getEngineUser } from '@/lib/engine/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { ENGINE_SERIES_JOB, ENGINE_SERIES_QUEUE, enqueueEngineJob } from '@/lib/engine/queue'
import { createContentPlanRow } from '@/lib/engine/createContentPlanRow'
import { createQueueItemRow } from '@/lib/engine/createQueueItemRow'

type CreateSeriesBody = {
  influencerId?: string
  title?: string
  theme?: string
  episodeCount?: number
  workspaceId?: string
}

function parseBody(value: unknown): CreateSeriesBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  const body = value as Record<string, unknown>
  return {
    influencerId: typeof body.influencerId === 'string' ? body.influencerId.trim() : undefined,
    title: typeof body.title === 'string' ? body.title.trim() : undefined,
    theme: typeof body.theme === 'string' ? body.theme.trim() : undefined,
    episodeCount:
      typeof body.episodeCount === 'number' && Number.isFinite(body.episodeCount)
        ? Math.floor(body.episodeCount)
        : undefined,
    workspaceId: typeof body.workspaceId === 'string' ? body.workspaceId.trim() : undefined,
  }
}

function buildEpisodeTitle(seriesTitle: string, index: number) {
  return `${seriesTitle} - Episode ${index}`
}

function buildEpisodePrompt(index: number, theme: string, seriesTitle: string, influencerName: string) {
  return [
    `Generate key art for episode ${index} of the series "${seriesTitle}".`,
    `Theme: ${theme}.`,
    `Influencer: ${influencerName}.`,
    'Output should be high-contrast, social-native, and campaign-ready.',
  ].join(' ')
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await getEngineUser(request)
    const admin = getEngineSupabaseAdmin()

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const body = parseBody(raw)
    if (!body.influencerId || !body.title || !body.theme || !body.episodeCount) {
      return NextResponse.json(
        { detail: 'influencerId, title, theme, and episodeCount are required' },
        { status: 400 }
      )
    }

    if (body.episodeCount < 1 || body.episodeCount > 100) {
      return NextResponse.json({ detail: 'episodeCount must be between 1 and 100' }, { status: 400 })
    }

    const { data: influencer } = await admin
      .from('influencers')
      .select('id, org_id, name, display_name, handle')
      .eq('id', body.influencerId)
      .maybeSingle()

    if (!influencer) {
      return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
    }

    const { data: member } = await admin
      .from('organization_members')
      .select('id')
      .eq('user_id', authUserId)
      .eq('org_id', influencer.org_id)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
    }

    const { data: series, error: seriesError } = await admin
      .from('series_projects')
      .insert({
        user_id: authUserId,
        organization_id: influencer.org_id,
        workspace_id: body.workspaceId || null,
        influencer_id: body.influencerId,
        title: body.title,
        theme: body.theme,
        episode_count: body.episodeCount,
        status: 'QUEUED',
        started_at: new Date().toISOString(),
      })
      .select('id, episode_count')
      .single()

    if (seriesError || !series) {
      return NextResponse.json({ detail: 'Failed to create series' }, { status: 500 })
    }

    let queuedCount = 0
    let failedCount = 0
    const influencerName =
      influencer.display_name || influencer.name || influencer.handle || `influencer ${influencer.id}`

    for (let episodeIndex = 1; episodeIndex <= body.episodeCount; episodeIndex += 1) {
      const title = buildEpisodeTitle(body.title, episodeIndex)
      const prompt = buildEpisodePrompt(episodeIndex, body.theme, body.title, influencerName)
      let episodeId: string | null = null

      try {
        const contentPlan = await createContentPlanRow({
          admin,
          influencerId: body.influencerId,
          orgId: influencer.org_id,
          theme: title,
          notes: prompt,
          date: new Date().toISOString().slice(0, 10),
        })

        const queueItem = await createQueueItemRow({
          admin,
          table: 'series_episodes',
          parentColumn: 'series_id',
          parentId: series.id,
          indexColumn: 'episode_index',
          indexValue: episodeIndex,
          title,
          prompt,
          contentPlanId: contentPlan.id,
        })
        episodeId = queueItem.id

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
          .update({ queue_job_id: queueJobId, error: null })
          .eq('id', queueItem.id)

        queuedCount += 1
      } catch (episodeError) {
        failedCount += 1
        if (episodeId) {
          await admin
            .from('series_episodes')
            .update({
              status: 'FAILED',
              error: episodeError instanceof Error ? episodeError.message : 'Failed to queue episode',
            })
            .eq('id', episodeId)
        }
      }
    }

    const nextStatus = queuedCount === 0 ? 'FAILED' : 'RUNNING'
    await admin
      .from('series_projects')
      .update({
        status: nextStatus,
        completed_at: queuedCount === 0 ? new Date().toISOString() : null,
      })
      .eq('id', series.id)

    return NextResponse.json({
      seriesId: series.id,
      episodeCount: series.episode_count,
      queuedEpisodes: queuedCount,
      failedEpisodes: failedCount,
      status: nextStatus,
    })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to create series' },
      { status }
    )
  }
}

export async function GET(request: Request) {
  try {
    const { authUserId } = await getEngineUser(request)
    const admin = getEngineSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')

    let query = admin
      .from('series_projects')
      .select('id, title, theme, status, episode_count, influencer_id, created_at, workspace_id')
      .eq('user_id', authUserId)
      .order('created_at', { ascending: false })

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId)
    }

    const { data, error } = await query
    if (error) {
      // Backward-compatible fallback when the new series tables are not migrated yet.
      if (error.code === '42P01') {
        const { data: legacyData, error: legacyError } = await admin
          .from('series')
          .select('id, title, theme, status, episode_count, influencer_id, created_at, workspace_id')
          .eq('user_id', authUserId)
          .order('created_at', { ascending: false })

        if (!legacyError) {
          return NextResponse.json({ items: legacyData ?? [] })
        }
      }

      return NextResponse.json(
        { detail: error.message || 'Failed to load series' },
        { status: 500 }
      )
    }

    return NextResponse.json({ items: data ?? [] })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load series' },
      { status }
    )
  }
}
