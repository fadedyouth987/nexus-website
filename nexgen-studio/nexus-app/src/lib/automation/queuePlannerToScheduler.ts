import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { normalizePlatformId } from '@/lib/social/platformPolicy'

type QueueResult = {
  queuedContent: number
  queuedSchedules: number
}

export async function queuePlannerToScheduler(params: {
  userId: string
  planId: string
  orgId: string
  workspaceId: string
  creatorId: string
}): Promise<QueueResult> {
  const admin = getEngineSupabaseAdmin()
  const { data: briefRow } = await admin
    .from('planner_plan_briefs')
    .select('constraints_json')
    .eq('plan_id', params.planId)
    .maybeSingle()
  const constraints =
    briefRow?.constraints_json && typeof briefRow.constraints_json === 'object'
      ? (briefRow.constraints_json as Record<string, unknown>)
      : {}
  const contentRating = constraints.content_rating === 'nsfw' ? 'nsfw' : 'sfw'

  const { data: items, error: itemsError } = await admin
    .from('planner_content_items')
    .select('id, day_number, publish_date, platform, post_type, title, hook, angle, caption_direction, cta, prompt_seed, status')
    .eq('plan_id', params.planId)
    .order('day_number', { ascending: true })

  if (itemsError) {
    throw new Error(itemsError.message || 'Failed to load planner items')
  }

  let queuedContent = 0
  let queuedSchedules = 0
  const safeItems = Array.isArray(items) ? items : []

  for (const item of safeItems) {
    const publishDate =
      typeof item.publish_date === 'string' && item.publish_date
        ? item.publish_date
        : new Date(Date.now() + Math.max(1, Number(item.day_number || 1)) * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10)
    const platformRaw = typeof item.platform === 'string' && item.platform.trim() ? item.platform.trim() : 'instagram'
    const platform = normalizePlatformId(platformRaw) || 'instagram'
    const scheduledFor = new Date(`${publishDate}T12:00:00.000Z`).toISOString()

    const contentPayload = {
      org_id: params.orgId,
      workspace_id: params.workspaceId,
      creator_id: params.creatorId,
      type: item.post_type === 'video' ? 'video' : 'post',
      status: 'scheduled',
      data: {
        planner: {
          plan_id: params.planId,
          planner_item_id: item.id,
          day_number: item.day_number,
        },
        title: item.title || item.hook || `Day ${item.day_number} content`,
        hook: item.hook || null,
        angle: item.angle || null,
        caption_direction: item.caption_direction || null,
        cta: item.cta || null,
        prompt_seed: item.prompt_seed || null,
        content_rating: contentRating,
        schedule: {
          platform,
          scheduled_for: scheduledFor,
          status: 'scheduled',
        },
      },
      created_by: params.userId,
    }

    const { data: content, error: contentError } = await admin
      .from('content_v2')
      .insert(contentPayload)
      .select('id')
      .single()
    if (contentError || !content?.id) {
      continue
    }
    queuedContent += 1

    const { error: scheduleError } = await admin.from('schedules_v2').insert({
      org_id: params.orgId,
      workspace_id: params.workspaceId,
      content_id: content.id,
      platform,
      scheduled_for: scheduledFor,
      status: 'scheduled',
    })
    if (!scheduleError) {
      queuedSchedules += 1
    }
  }

  return { queuedContent, queuedSchedules }
}
