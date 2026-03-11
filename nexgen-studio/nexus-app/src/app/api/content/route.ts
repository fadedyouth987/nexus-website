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
  type WorkspaceRole,
} from '@/lib/server/v2Access'

const contentTypes = new Set(['image', 'video', 'caption', 'post'])
const contentStatuses = new Set([
  'draft',
  'internal_review',
  'client_review',
  'scheduled',
  'published',
  'failed',
  'archived',
])

const editorTransitions: Record<string, string[]> = {
  draft: ['internal_review', 'client_review', 'archived'],
  internal_review: ['draft', 'client_review', 'scheduled', 'failed', 'archived'],
  client_review: ['internal_review', 'scheduled', 'archived'],
  scheduled: ['published', 'failed', 'archived'],
  published: ['archived'],
  failed: ['draft', 'archived'],
  archived: [],
}

const viewerTransitions: Record<string, string[]> = {
  client_review: ['internal_review'],
}

function isValidContentType(value: unknown): value is string {
  return typeof value === 'string' && contentTypes.has(value)
}

function isValidContentStatus(value: unknown): value is string {
  return typeof value === 'string' && contentStatuses.has(value)
}

function canTransition(role: WorkspaceRole, currentStatus: string, nextStatus: string) {
  const allowedMap = role === 'viewer' ? viewerTransitions : editorTransitions
  return allowedMap[currentStatus]?.includes(nextStatus) ?? false
}

function getScheduleFields(data: Record<string, unknown> | null | undefined) {
  const schedule =
    data && typeof data.schedule === 'object' && data.schedule !== null
      ? (data.schedule as Record<string, unknown>)
      : {}

  const platform = typeof schedule.platform === 'string' && schedule.platform.trim() ? schedule.platform.trim() : 'instagram'
  const scheduledFor =
    typeof schedule.scheduled_for === 'string' && schedule.scheduled_for
      ? schedule.scheduled_for
      : new Date(Date.now() + 60 * 60 * 1000).toISOString()

  return {
    platform,
    scheduledFor,
  }
}

async function syncScheduleForContent(opts: {
  supabase: any
  orgId: string
  workspaceId: string
  contentId: string
  nextStatus: string
  data: Record<string, unknown> | null | undefined
}) {
  const { data: existingRows, error: existingError } = await opts.supabase
    .from('schedules_v2')
    .select('id, status')
    .eq('org_id', opts.orgId)
    .eq('workspace_id', opts.workspaceId)
    .eq('content_id', opts.contentId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (existingError) {
    throw new AccessError(500, 'Failed to sync schedule state')
  }

  const existing = Array.isArray(existingRows) ? existingRows[0] : null

  if (opts.nextStatus === 'scheduled') {
    const scheduleFields = getScheduleFields(opts.data)

    if (existing) {
      const { error } = await opts.supabase
        .from('schedules_v2')
        .update({
          platform: scheduleFields.platform,
          scheduled_for: scheduleFields.scheduledFor,
          status: 'scheduled',
        })
        .eq('id', existing.id)
        .eq('org_id', opts.orgId)
        .eq('workspace_id', opts.workspaceId)

      if (error) {
        throw new AccessError(500, 'Failed to update schedule')
      }
    } else {
      const { error } = await opts.supabase.from('schedules_v2').insert({
        org_id: opts.orgId,
        workspace_id: opts.workspaceId,
        content_id: opts.contentId,
        platform: scheduleFields.platform,
        scheduled_for: scheduleFields.scheduledFor,
        status: 'scheduled',
      })

      if (error) {
        throw new AccessError(500, 'Failed to create schedule')
      }
    }

    return
  }

  if (existing && ['queued', 'scheduled'].includes(existing.status) && opts.nextStatus !== 'scheduled') {
    const { error } = await opts.supabase
      .from('schedules_v2')
      .update({
        status: 'canceled',
      })
      .eq('id', existing.id)
      .eq('org_id', opts.orgId)
      .eq('workspace_id', opts.workspaceId)

    if (error) {
      throw new AccessError(500, 'Failed to cancel schedule')
    }
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
      .from('content_v2')
      .select('id, org_id, workspace_id, creator_id, type, status, data, created_by, legacy_source, legacy_id, created_at, updated_at')
      .eq('org_id', org.orgId)
      .eq('workspace_id', workspace.workspaceId)
      .order('created_at', { ascending: false })

    const creatorId = searchParams.get('creator_id')
    const id = searchParams.get('id')
    const type = searchParams.get('type')
    const status = searchParams.get('status')

    if (id) {
      query = query.eq('id', id)
    }
    if (creatorId) {
      query = query.eq('creator_id', creatorId)
    }
    if (isValidContentType(type)) {
      query = query.eq('type', type)
    }
    if (isValidContentStatus(status)) {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      throw new AccessError(500, 'Failed to load content')
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
      { detail: error instanceof Error ? error.message : 'Failed to load content' },
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
      creator_id?: string
      type?: string
      status?: string
      data?: Record<string, unknown>
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    if (!body.creator_id) {
      return NextResponse.json({ detail: 'creator_id is required' }, { status: 400 })
    }

    if (!isValidContentType(body.type)) {
      return NextResponse.json({ detail: 'type is invalid' }, { status: 400 })
    }

    const requestedStatus = body.status ?? 'draft'
    if (!isValidContentStatus(requestedStatus)) {
      return NextResponse.json({ detail: 'status is invalid' }, { status: 400 })
    }

    const { data: creator, error: creatorError } = await supabase
      .from('creators_v2')
      .select('id')
      .eq('id', body.creator_id)
      .eq('org_id', org.orgId)
      .eq('workspace_id', workspace.workspaceId)
      .maybeSingle()

    if (creatorError) {
      throw new AccessError(500, 'Failed to validate creator')
    }

    if (!creator) {
      throw new AccessError(404, 'Creator not found')
    }

    const { data, error } = await supabase
      .from('content_v2')
      .insert({
        org_id: org.orgId,
        workspace_id: workspace.workspaceId,
        creator_id: body.creator_id,
        type: body.type,
        status: requestedStatus,
        data: body.data && typeof body.data === 'object' ? body.data : {},
        created_by: user.userId,
      })
      .select('id, org_id, workspace_id, creator_id, type, status, data, created_by, created_at, updated_at')
      .single()

    if (error) {
      throw new AccessError(500, 'Failed to create content')
    }

    await syncScheduleForContent({
      supabase,
      orgId: org.orgId,
      workspaceId: workspace.workspaceId,
      contentId: data.id,
      nextStatus: data.status,
      data: data.data,
    })

    await writeActivityLog({
      supabase,
      orgId: org.orgId,
      workspaceId: workspace.workspaceId,
      actorId: user.userId,
      action: 'content.created',
      entityType: 'content',
      entityId: data.id,
      metadata: {
        creator_id: data.creator_id,
        type: data.type,
        status: data.status,
      },
    })

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to create content' },
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

    let body: {
      id?: string
      status?: string
      data?: Record<string, unknown>
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    if (!body.id) {
      return NextResponse.json({ detail: 'id is required' }, { status: 400 })
    }

    const { data: existing, error: existingError } = await supabase
      .from('content_v2')
      .select('id, status, data')
      .eq('id', body.id)
      .eq('org_id', org.orgId)
      .eq('workspace_id', workspace.workspaceId)
      .maybeSingle()

    if (existingError) {
      throw new AccessError(500, 'Failed to load content')
    }

    if (!existing) {
      throw new AccessError(404, 'Content not found')
    }

    const updates: Record<string, unknown> = {}
    let nextStatus = existing.status
    let nextData = existing.data as Record<string, unknown>

    if (body.status !== undefined) {
      if (!isValidContentStatus(body.status)) {
        return NextResponse.json({ detail: 'status is invalid' }, { status: 400 })
      }

      if (!canTransition(workspace.role, existing.status, body.status)) {
        throw new AccessError(403, 'Invalid status transition for this role')
      }

      updates.status = body.status
      nextStatus = body.status
    } else {
      requireRoleAtLeast(workspace.role, 'editor')
    }

    if (body.data !== undefined) {
      requireRoleAtLeast(workspace.role, 'editor')
      updates.data = body.data && typeof body.data === 'object' ? body.data : existing.data
      nextData = updates.data as Record<string, unknown>
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ detail: 'No changes submitted' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('content_v2')
      .update(updates)
      .eq('id', body.id)
      .eq('org_id', org.orgId)
      .eq('workspace_id', workspace.workspaceId)
      .select('id, org_id, workspace_id, creator_id, type, status, data, created_by, created_at, updated_at')
      .single()

    if (error) {
      throw new AccessError(500, 'Failed to update content')
    }

    await syncScheduleForContent({
      supabase,
      orgId: org.orgId,
      workspaceId: workspace.workspaceId,
      contentId: data.id,
      nextStatus,
      data: nextData,
    })

    await writeActivityLog({
      supabase,
      orgId: org.orgId,
      workspaceId: workspace.workspaceId,
      actorId: user.userId,
      action: updates.status ? 'content.status_changed' : 'content.updated',
      entityType: 'content',
      entityId: data.id,
      metadata: {
        previous_status: existing.status,
        next_status: data.status,
        data_updated: body.data !== undefined,
        role: workspace.role,
      },
    })

    return NextResponse.json(data)
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500

    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to update content' },
      { status }
    )
  }
}
