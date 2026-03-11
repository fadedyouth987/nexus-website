import { NextResponse } from 'next/server'
import { isPortfolioV2ServerEnabled } from '@/lib/core/featureFlags'
import { writeActivityLog } from '@/lib/server/activityLog'
import {
  canPublishContentToPlatform,
  normalizeContentRating,
  normalizePlatformId,
} from '@/lib/social/platformPolicy'
import {
  AccessError,
  getServerSupabase,
  getServerUser,
  requireOrgMembership,
  requireRoleAtLeast,
  requireWorkspaceAccess,
} from '@/lib/server/v2Access'

const scheduleStatuses = new Set(['queued', 'scheduled', 'published', 'failed', 'canceled'])
const scheduleToContentStatus: Record<string, string> = {
  queued: 'scheduled',
  scheduled: 'scheduled',
  published: 'published',
  failed: 'failed',
  canceled: 'internal_review',
}

function isValidScheduleStatus(value: unknown): value is string {
  return typeof value === 'string' && scheduleStatuses.has(value)
}

function isPerformanceSeedStatus(value: string) {
  return value === 'published'
}

function getScheduleMetadata(
  existingData: Record<string, unknown> | null | undefined,
  schedule: {
    platform: string | null
    scheduled_for: string | null
    status: string
  }
) {
  const nextData =
    existingData && typeof existingData === 'object' && !Array.isArray(existingData)
      ? { ...existingData }
      : {}

  nextData.schedule = {
    platform: schedule.platform,
    scheduled_for: schedule.scheduled_for,
    status: schedule.status,
  }

  return nextData
}

function getContentRatingFromData(data: Record<string, unknown> | null | undefined): 'sfw' | 'nsfw' {
  const raw = data?.content_rating
  return normalizeContentRating(raw)
}

async function assertSchedulePublishAllowed(opts: {
  supabase: any
  platform: string | null
  contentData: Record<string, unknown> | null | undefined
  contentOwnerId: string | null
}) {
  const normalizedPlatform = normalizePlatformId(opts.platform || 'instagram') || 'instagram'
  const contentRating = getContentRatingFromData(opts.contentData)

  if (!canPublishContentToPlatform(normalizedPlatform, contentRating)) {
    throw new AccessError(
      400,
      `${normalizedPlatform} does not allow ${contentRating.toUpperCase()} publishing in Nexus policy.`
    )
  }

  if (contentRating === 'nsfw') {
    if (!opts.contentOwnerId) {
      throw new AccessError(403, 'NSFW scheduling blocked: content owner is missing.')
    }
    const { data: profile, error: profileError } = await opts.supabase
      .from('blueprint_users')
      .select('age_verified_at')
      .eq('id', opts.contentOwnerId)
      .maybeSingle()

    if (profileError) {
      throw new AccessError(500, 'Failed to verify NSFW access')
    }
    if (!profile?.age_verified_at) {
      throw new AccessError(
        403,
        'NSFW scheduling is gated until 18+ age verification is complete.'
      )
    }
  }
}

async function syncContentForSchedule(opts: {
  supabase: any
  orgId: string
  workspaceId: string
  contentId: string
  platform: string | null
  scheduledFor: string | null
  scheduleStatus: string
}) {
  const nextContentStatus = scheduleToContentStatus[opts.scheduleStatus] ?? 'internal_review'

  const { data: existingContent, error: existingContentError } = await opts.supabase
    .from('content_v2')
    .select('id, data')
    .eq('id', opts.contentId)
    .eq('org_id', opts.orgId)
    .eq('workspace_id', opts.workspaceId)
    .maybeSingle()

  if (existingContentError) {
    throw new AccessError(500, 'Failed to load linked content')
  }

  if (!existingContent) {
    throw new AccessError(404, 'Content not found')
  }

  const nextData = getScheduleMetadata(existingContent.data as Record<string, unknown>, {
    platform: opts.platform,
    scheduled_for: opts.scheduledFor,
    status: opts.scheduleStatus,
  })

  const { data: syncedContent, error: contentUpdateError } = await opts.supabase
    .from('content_v2')
    .update({
      status: nextContentStatus,
      data: nextData,
    })
    .eq('id', opts.contentId)
    .eq('org_id', opts.orgId)
    .eq('workspace_id', opts.workspaceId)
    .select('id, org_id, workspace_id, creator_id, type, status, data, created_by, created_at, updated_at')
    .single()

  if (contentUpdateError) {
    throw new AccessError(500, 'Failed to sync linked content')
  }

  return syncedContent
}

async function seedPerformanceForPublishedContent(opts: {
  supabase: any
  orgId: string
  workspaceId: string
  contentId: string
  content: {
    data: Record<string, unknown>
  }
  shouldSeed: boolean
}) {
  if (!opts.shouldSeed) {
    return
  }

  const scheduleData =
    opts.content.data &&
    typeof opts.content.data === 'object' &&
    opts.content.data.schedule &&
    typeof opts.content.data.schedule === 'object'
      ? (opts.content.data.schedule as Record<string, unknown>)
      : {}

  const platform = typeof scheduleData.platform === 'string' ? scheduleData.platform : null

  const { error } = await opts.supabase.from('performance_v2').insert({
    org_id: opts.orgId,
    workspace_id: opts.workspaceId,
    content_id: opts.contentId,
    platform,
    views: 0,
    engagement: 0,
    revenue: 0,
  })

  if (error) {
    throw new AccessError(500, 'Failed to seed baseline performance')
  }
}

export async function GET(request: Request) {
  if (!isPortfolioV2ServerEnabled()) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  }

  try {
    const supabase = await getServerSupabase(request)
    const user = await getServerUser(request)
    const { searchParams } = new URL(request.url)
    const org = await requireOrgMembership(request, {
      supabase,
      user,
      orgId: searchParams.get('org_id'),
    })
    const workspace = await requireWorkspaceAccess(request, {
      supabase,
      user,
      orgId: org.orgId,
      workspaceId: searchParams.get('workspace_id'),
    })

    let query = supabase
      .from('schedules_v2')
      .select('id, org_id, workspace_id, content_id, platform, scheduled_for, status, error, created_at')
      .eq('org_id', org.orgId)
      .eq('workspace_id', workspace.workspaceId)
      .order('scheduled_for', { ascending: true, nullsFirst: false })

    const id = searchParams.get('id')
    const contentId = searchParams.get('content_id')
    const status = searchParams.get('status')

    if (id) {
      query = query.eq('id', id)
    }
    if (contentId) {
      query = query.eq('content_id', contentId)
    }
    if (isValidScheduleStatus(status)) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      throw new AccessError(500, 'Failed to load schedules')
    }

    return NextResponse.json({
      items: data ?? [],
      meta: {
        org_id: org.orgId,
        workspace_id: workspace.workspaceId,
        workspace_name: workspace.workspaceName,
        role: workspace.role,
      },
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load schedules' },
      { status }
    )
  }
}

export async function POST(request: Request) {
  if (!isPortfolioV2ServerEnabled()) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  }

  try {
    const supabase = await getServerSupabase(request)
    const user = await getServerUser(request)
    const { searchParams } = new URL(request.url)
    const org = await requireOrgMembership(request, {
      supabase,
      user,
      orgId: searchParams.get('org_id'),
    })
    const workspace = await requireWorkspaceAccess(request, {
      supabase,
      user,
      orgId: org.orgId,
      workspaceId: searchParams.get('workspace_id'),
    })

    requireRoleAtLeast(workspace.role, 'editor')

    let body: {
      content_id?: string
      platform?: string
      scheduled_for?: string
      status?: string
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    if (!body.content_id) {
      return NextResponse.json({ detail: 'content_id is required' }, { status: 400 })
    }

    const statusValue = body.status ?? 'scheduled'
    if (!isValidScheduleStatus(statusValue)) {
      return NextResponse.json({ detail: 'status is invalid' }, { status: 400 })
    }

    const { data: content, error: contentError } = await supabase
      .from('content_v2')
      .select('id, data, created_by')
      .eq('id', body.content_id)
      .eq('org_id', org.orgId)
      .eq('workspace_id', workspace.workspaceId)
      .maybeSingle()

    if (contentError) {
      throw new AccessError(500, 'Failed to validate content')
    }

    if (!content) {
      throw new AccessError(404, 'Content not found')
    }

    if (['queued', 'scheduled', 'published'].includes(statusValue)) {
      await assertSchedulePublishAllowed({
        supabase,
        platform: body.platform?.trim() || 'instagram',
        contentData: content.data as Record<string, unknown> | null | undefined,
        contentOwnerId:
          typeof content.created_by === 'string' && content.created_by
            ? content.created_by
            : user.userId,
      })
    }

    const { data, error } = await supabase
      .from('schedules_v2')
      .insert({
        org_id: org.orgId,
        workspace_id: workspace.workspaceId,
        content_id: body.content_id,
        platform: normalizePlatformId(body.platform?.trim() || '') || null,
        scheduled_for: body.scheduled_for || null,
        status: statusValue,
      })
      .select('id, org_id, workspace_id, content_id, platform, scheduled_for, status, error, created_at')
      .single()

    if (error) {
      throw new AccessError(500, 'Failed to create schedule')
    }

    const syncedContent = await syncContentForSchedule({
      supabase,
      orgId: org.orgId,
      workspaceId: workspace.workspaceId,
      contentId: data.content_id,
      platform: data.platform,
      scheduledFor: data.scheduled_for,
      scheduleStatus: data.status,
    })

    await seedPerformanceForPublishedContent({
      supabase,
      orgId: org.orgId,
      workspaceId: workspace.workspaceId,
      contentId: data.content_id,
      content: syncedContent,
      shouldSeed: isPerformanceSeedStatus(data.status),
    })

    await writeActivityLog({
      supabase,
      orgId: org.orgId,
      workspaceId: workspace.workspaceId,
      actorId: user.userId,
      action: 'schedule.created',
      entityType: 'schedule',
      entityId: data.id,
      metadata: {
        content_id: data.content_id,
        status: data.status,
        platform: data.platform,
        scheduled_for: data.scheduled_for,
      },
    })

    return NextResponse.json(
      {
        schedule: data,
        content: syncedContent,
      },
      { status: 201 }
    )
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to create schedule' },
      { status }
    )
  }
}

export async function PATCH(request: Request) {
  if (!isPortfolioV2ServerEnabled()) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  }

  try {
    const supabase = await getServerSupabase(request)
    const user = await getServerUser(request)
    const { searchParams } = new URL(request.url)
    const org = await requireOrgMembership(request, {
      supabase,
      user,
      orgId: searchParams.get('org_id'),
    })
    const workspace = await requireWorkspaceAccess(request, {
      supabase,
      user,
      orgId: org.orgId,
      workspaceId: searchParams.get('workspace_id'),
    })

    requireRoleAtLeast(workspace.role, 'editor')

    let body: {
      id?: string
      platform?: string
      scheduled_for?: string | null
      status?: string
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    if (!body.id) {
      return NextResponse.json({ detail: 'id is required' }, { status: 400 })
    }

    const { data: existingSchedule, error: existingScheduleError } = await supabase
      .from('schedules_v2')
      .select('id, content_id, platform, scheduled_for, status')
      .eq('id', body.id)
      .eq('org_id', org.orgId)
      .eq('workspace_id', workspace.workspaceId)
      .maybeSingle()

    if (existingScheduleError) {
      throw new AccessError(500, 'Failed to load schedule')
    }

    if (!existingSchedule) {
      throw new AccessError(404, 'Schedule not found')
    }

    const updates: Record<string, unknown> = {}

    if (body.platform !== undefined) {
      updates.platform = normalizePlatformId(body.platform?.trim() || '') || null
    }
    if (body.scheduled_for !== undefined) {
      updates.scheduled_for = body.scheduled_for
    }
    if (body.status !== undefined) {
      if (!isValidScheduleStatus(body.status)) {
        return NextResponse.json({ detail: 'status is invalid' }, { status: 400 })
      }
      updates.status = body.status
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ detail: 'No changes submitted' }, { status: 400 })
    }

    const nextStatus = typeof updates.status === 'string' ? updates.status : existingSchedule.status
    const nextPlatform =
      (typeof updates.platform === 'string' ? updates.platform : existingSchedule.platform) || 'instagram'

    if (['queued', 'scheduled', 'published'].includes(nextStatus)) {
      const { data: contentRow, error: contentError } = await supabase
        .from('content_v2')
        .select('id, data, created_by')
        .eq('id', existingSchedule.content_id)
        .eq('org_id', org.orgId)
        .eq('workspace_id', workspace.workspaceId)
        .maybeSingle()

      if (contentError) {
        throw new AccessError(500, 'Failed to validate linked content')
      }
      if (!contentRow) {
        throw new AccessError(404, 'Content not found')
      }

      await assertSchedulePublishAllowed({
        supabase,
        platform: nextPlatform,
        contentData: contentRow.data as Record<string, unknown> | null | undefined,
        contentOwnerId:
          typeof contentRow.created_by === 'string' && contentRow.created_by
            ? contentRow.created_by
            : user.userId,
      })
    }

    const { data, error } = await supabase
      .from('schedules_v2')
      .update(updates)
      .eq('id', body.id)
      .eq('org_id', org.orgId)
      .eq('workspace_id', workspace.workspaceId)
      .select('id, org_id, workspace_id, content_id, platform, scheduled_for, status, error, created_at')
      .single()

    if (error) {
      throw new AccessError(500, 'Failed to update schedule')
    }

    const syncedContent = await syncContentForSchedule({
      supabase,
      orgId: org.orgId,
      workspaceId: workspace.workspaceId,
      contentId: data.content_id,
      platform: data.platform,
      scheduledFor: data.scheduled_for,
      scheduleStatus: data.status,
    })

    await seedPerformanceForPublishedContent({
      supabase,
      orgId: org.orgId,
      workspaceId: workspace.workspaceId,
      contentId: data.content_id,
      content: syncedContent,
      shouldSeed: existingSchedule.status !== 'published' && isPerformanceSeedStatus(data.status),
    })

    await writeActivityLog({
      supabase,
      orgId: org.orgId,
      workspaceId: workspace.workspaceId,
      actorId: user.userId,
      action: updates.status ? 'schedule.status_changed' : 'schedule.updated',
      entityType: 'schedule',
      entityId: data.id,
      metadata: {
        content_id: data.content_id,
        previous_status: existingSchedule.status,
        next_status: data.status,
        platform: data.platform,
        scheduled_for: data.scheduled_for,
      },
    })

    return NextResponse.json({
      schedule: data,
      content: syncedContent,
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to update schedule' },
      { status }
    )
  }
}
