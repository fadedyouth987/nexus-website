import { NextResponse } from 'next/server'
import { getEngineUser } from '@/lib/engine/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { ENGINE_SERIES_JOB, ENGINE_SERIES_QUEUE, enqueueEngineJob } from '@/lib/engine/queue'
import { loadOwnedSeries } from '@/lib/engine/series'

type RegenerateEpisodeBody = {
  title?: string
  prompt?: string
}

function parseBody(value: unknown): RegenerateEpisodeBody {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const body = value as Record<string, unknown>
  return {
    title: typeof body.title === 'string' ? body.title.trim() : undefined,
    prompt: typeof body.prompt === 'string' ? body.prompt.trim() : undefined,
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ seriesId: string; episodeId: string }> }
) {
  try {
    const { authUserId } = await getEngineUser(request)
    const admin = getEngineSupabaseAdmin()
    const { seriesId, episodeId } = await context.params
    await loadOwnedSeries(admin, authUserId, seriesId)

    const { data: episode } = await admin
      .from('series_episodes')
      .select('id, series_id, title, prompt, content_plan_id')
      .eq('id', episodeId)
      .eq('series_id', seriesId)
      .maybeSingle()

    if (!episode) {
      return NextResponse.json({ detail: 'Episode not found' }, { status: 404 })
    }

    let raw: unknown
    try {
      raw = await request.json()
    } catch {
      raw = {}
    }
    const body = parseBody(raw)

    const nextTitle = body.title || episode.title || `Episode`
    const nextPrompt = body.prompt || episode.prompt || `Regenerate episode art`

    const queueJobId = await enqueueEngineJob({
      queueName: ENGINE_SERIES_QUEUE,
      jobName: ENGINE_SERIES_JOB,
      payload: {
        kind: 'series_episode',
        seriesEpisodeId: episodeId,
      },
    })

    await admin
      .from('series_episodes')
      .update({
        title: nextTitle,
        prompt: nextPrompt,
        status: 'QUEUED',
        queue_job_id: queueJobId,
        error: null,
      })
      .eq('id', episodeId)

    if (episode.content_plan_id) {
      await admin
        .from('content_plans')
        .update({
          theme: nextTitle,
          notes: nextPrompt,
        })
        .eq('id', episode.content_plan_id)
    }

    await admin
      .from('series_projects')
      .update({ status: 'RUNNING', completed_at: null })
      .eq('id', seriesId)

    return NextResponse.json({
      ok: true,
      episodeId,
      queueJobId,
    })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to regenerate episode' },
      { status }
    )
  }
}
