import { NextResponse } from 'next/server'
import { isPortfolioV2ServerEnabled } from '@/lib/core/featureFlags'
import { writeActivityLog } from '@/lib/server/activityLog'
import {
  AccessError,
  getServerSupabase,
  getServerUser,
  requireOrgMembership,
  requireRoleAtLeast,
  requireWorkspaceAccess,
} from '@/lib/server/v2Access'

function loadQueue() {
  const req = eval('require') as NodeRequire
  return req('bullmq').Queue
}

function loadRedis() {
  const req = eval('require') as NodeRequire
  return req('ioredis')
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new AccessError(500, `Missing required environment variable: ${name}`)
  }
  return value
}

function resolvePrompt(bodyPrompt: string | undefined, rowData: unknown) {
  const fromBody = typeof bodyPrompt === 'string' && bodyPrompt.trim() ? bodyPrompt.trim() : ''

  if (fromBody) {
    return fromBody
  }

  if (rowData && typeof rowData === 'object' && !Array.isArray(rowData)) {
    const dataPrompt = (rowData as Record<string, unknown>).prompt
    if (typeof dataPrompt === 'string' && dataPrompt.trim()) {
      return dataPrompt.trim()
    }
  }

  return ''
}

export async function POST(request: Request) {
  if (!isPortfolioV2ServerEnabled()) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  }

  let redis: any = null
  let queue: any = null

  try {
    const supabase = await getServerSupabase(request)
    const user = await getServerUser(request)
    const { searchParams } = new URL(request.url)
    const org = await requireOrgMembership(request, {
      supabase,
      user,
      orgId: searchParams.get('org_id'),
    })

    let body: {
      content_id?: string
      prompt?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    if (!body.content_id || typeof body.content_id !== 'string') {
      return NextResponse.json({ detail: 'content_id is required' }, { status: 400 })
    }

    const { data: content, error: contentError } = await supabase
      .from('content_v2')
      .select('id, org_id, workspace_id, type, data')
      .eq('id', body.content_id)
      .eq('org_id', org.orgId)
      .maybeSingle()

    if (contentError) {
      throw new AccessError(500, 'Failed to load content')
    }

    if (!content) {
      throw new AccessError(404, 'Content not found')
    }

    const workspace = await requireWorkspaceAccess(request, {
      supabase,
      user,
      orgId: org.orgId,
      workspaceId: content.workspace_id,
    })

    requireRoleAtLeast(workspace.role, 'editor')

    if (content.type !== 'image') {
      return NextResponse.json(
        { detail: `Safe-image generation supports image content only (received ${content.type})` },
        { status: 400 }
      )
    }

    const prompt = resolvePrompt(body.prompt, content.data)
    if (!prompt) {
      return NextResponse.json(
        { detail: 'Prompt is required (body.prompt or content_v2.data.prompt)' },
        { status: 400 }
      )
    }

    const IORedis = loadRedis()
    const Queue = loadQueue()
    redis = new IORedis(requireEnv('REDIS_URL'), { maxRetriesPerRequest: null })
    queue = new Queue('generation-safe-image', { connection: redis })

    const job = await queue.add(
      'generate-safe-image-v2',
      {
        kind: 'content_v2_safe_image',
        org_id: org.orgId,
        workspace_id: workspace.workspaceId,
        content_id: content.id,
        prompt,
        requested_at: new Date().toISOString(),
        requested_by: user.userId,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      }
    )

    if (!job?.id) {
      throw new AccessError(500, 'Failed to enqueue generation job')
    }

    await writeActivityLog({
      supabase,
      orgId: org.orgId,
      workspaceId: workspace.workspaceId,
      actorId: user.userId,
      action: 'generation.safe_image.queued',
      entityType: 'content',
      entityId: content.id,
      metadata: {
        job_id: String(job.id),
        queue: 'generation-safe-image',
        workflow_preset: 'safe-image-v1',
      },
    })

    return NextResponse.json({
      ok: true,
      job_id: String(job.id),
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to enqueue safe-image generation' },
      { status }
    )
  } finally {
    if (queue) {
      await queue.close().catch(() => null)
    }
    if (redis) {
      await redis.quit().catch(() => null)
    }
  }
}
