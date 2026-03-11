import { getWorkerSupabaseAdmin } from '../core/supabaseAdmin'
import { publishToPlatform } from './platformPublishers'
import { writeActivityLog } from '../../../src/lib/server/activityLog'
import {
  canPublishContentToPlatform,
  normalizeContentRating,
  normalizePlatformId,
} from '../../../src/lib/social/platformPolicy'

type ScheduleRow = {
  id: string
  org_id: string
  workspace_id: string
  content_id: string
  platform: string | null
  scheduled_for: string | null
  status: string
}

async function hasVerifiedNsfwAccess(
  admin: any,
  userId: string,
  cache: Map<string, boolean>
): Promise<boolean> {
  if (cache.has(userId)) {
    return Boolean(cache.get(userId))
  }

  const { data } = await admin
    .from('blueprint_users')
    .select('age_verified_at')
    .eq('id', userId)
    .maybeSingle()

  const verified = Boolean(data?.age_verified_at)
  cache.set(userId, verified)
  return verified
}

async function markScheduleFailed(admin: any, schedule: ScheduleRow, message: string) {
  const failedAt = new Date().toISOString()

  await admin
    .from('schedules_v2')
    .update({
      status: 'failed',
      error: { message, failed_at: failedAt },
    })
    .eq('id', schedule.id)
    .eq('org_id', schedule.org_id)
    .eq('workspace_id', schedule.workspace_id)

  await admin
    .from('content_v2')
    .update({
      status: 'failed',
    })
    .eq('id', schedule.content_id)
    .eq('org_id', schedule.org_id)
    .eq('workspace_id', schedule.workspace_id)

  await writeActivityLog({
    supabase: admin,
    orgId: schedule.org_id,
    workspaceId: schedule.workspace_id,
    action: 'schedule.publish_failed',
    entityType: 'schedule',
    entityId: schedule.id,
    metadata: {
      content_id: schedule.content_id,
      platform: schedule.platform,
      error_message: message,
      failed_at: failedAt,
      source: 'worker.publish_due_schedules',
    },
  })

  await writeActivityLog({
    supabase: admin,
    orgId: schedule.org_id,
    workspaceId: schedule.workspace_id,
    action: 'content.publish_failed',
    entityType: 'content',
    entityId: schedule.content_id,
    metadata: {
      schedule_id: schedule.id,
      platform: schedule.platform,
      error_message: message,
      failed_at: failedAt,
      source: 'worker.publish_due_schedules',
    },
  })
}

export async function publishDueSchedules(limit = 20) {
  const admin = getWorkerSupabaseAdmin()
  const nowIso = new Date().toISOString()
  const nsfwVerifiedCache = new Map<string, boolean>()

  const { data: schedules, error } = await admin
    .from('schedules_v2')
    .select('id, org_id, workspace_id, content_id, platform, scheduled_for, status')
    .in('status', ['queued', 'scheduled'])
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true, nullsFirst: true })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to load due schedules: ${error.message}`)
  }

  for (const schedule of (schedules || []) as ScheduleRow[]) {
    try {
      if (!schedule.platform) {
        throw new Error('Missing platform')
      }
      const normalizedPlatform = normalizePlatformId(schedule.platform)
      if (!normalizedPlatform) {
        throw new Error('Invalid platform')
      }

      const { data: content, error: contentReadError } = await admin
        .from('content_v2')
        .select('data, created_by')
        .eq('id', schedule.content_id)
        .eq('org_id', schedule.org_id)
        .eq('workspace_id', schedule.workspace_id)
        .maybeSingle()

      if (contentReadError || !content) {
        throw new Error('Linked content not found')
      }
      const contentData =
        content.data && typeof content.data === 'object' && !Array.isArray(content.data)
          ? { ...(content.data as Record<string, unknown>) }
          : {}
      const contentRating = normalizeContentRating(contentData.content_rating)

      if (!canPublishContentToPlatform(normalizedPlatform, contentRating)) {
        throw new Error(`${normalizedPlatform} does not allow ${contentRating.toUpperCase()} publishing`)
      }

      if (contentRating === 'nsfw') {
        const contentOwnerId = typeof content.created_by === 'string' ? content.created_by : null
        if (!contentOwnerId) {
          throw new Error('NSFW publish blocked: content owner is missing')
        }
        const verified = await hasVerifiedNsfwAccess(admin, contentOwnerId, nsfwVerifiedCache)
        if (!verified) {
          throw new Error('NSFW publish blocked: 18+ age verification is required')
        }
      }

      const publishResult = await publishToPlatform({
        scheduleId: schedule.id,
        platform: normalizedPlatform,
        contentId: schedule.content_id,
        orgId: schedule.org_id,
        workspaceId: schedule.workspace_id,
        payload: contentData,
      })

      contentData.publish = {
        ...(contentData.publish && typeof contentData.publish === 'object'
          ? (contentData.publish as Record<string, unknown>)
          : {}),
        platform: normalizedPlatform,
        external_post_id: publishResult.externalPostId,
        published_at: publishResult.publishedAt,
      }

      await admin
        .from('schedules_v2')
        .update({
          platform: normalizedPlatform,
          status: 'published',
          error: {},
        })
        .eq('id', schedule.id)
        .eq('org_id', schedule.org_id)
        .eq('workspace_id', schedule.workspace_id)

      await admin
        .from('content_v2')
        .update({
          status: 'published',
          data: contentData,
        })
        .eq('id', schedule.content_id)
        .eq('org_id', schedule.org_id)
        .eq('workspace_id', schedule.workspace_id)

      await writeActivityLog({
        supabase: admin,
        orgId: schedule.org_id,
        workspaceId: schedule.workspace_id,
        action: 'schedule.published',
        entityType: 'schedule',
        entityId: schedule.id,
        metadata: {
          content_id: schedule.content_id,
          platform: normalizedPlatform,
          content_rating: contentRating,
          external_post_id: publishResult.externalPostId,
          published_at: publishResult.publishedAt,
          source: 'worker.publish_due_schedules',
        },
      })

      await writeActivityLog({
        supabase: admin,
        orgId: schedule.org_id,
        workspaceId: schedule.workspace_id,
        action: 'content.published',
        entityType: 'content',
        entityId: schedule.content_id,
        metadata: {
          schedule_id: schedule.id,
          platform: normalizedPlatform,
          content_rating: contentRating,
          external_post_id: publishResult.externalPostId,
          published_at: publishResult.publishedAt,
          source: 'worker.publish_due_schedules',
        },
      })

      const { data: seededPerformance, error: performanceInsertError } = await admin.from('performance_v2').insert({
        org_id: schedule.org_id,
        workspace_id: schedule.workspace_id,
        content_id: schedule.content_id,
        platform: normalizedPlatform,
        views: 0,
        engagement: 0,
        revenue: 0,
      }).select('id, recorded_at').single()

      if (performanceInsertError) {
        throw new Error(`Failed to seed performance: ${performanceInsertError.message}`)
      }

      await writeActivityLog({
        supabase: admin,
        orgId: schedule.org_id,
        workspaceId: schedule.workspace_id,
        action: 'performance.seeded',
        entityType: 'performance',
        entityId: seededPerformance?.id || null,
        metadata: {
          content_id: schedule.content_id,
          schedule_id: schedule.id,
          platform: normalizedPlatform,
          content_rating: contentRating,
          recorded_at: seededPerformance?.recorded_at || null,
          source: 'worker.publish_due_schedules',
        },
      })
    } catch (err) {
      await markScheduleFailed(
        admin,
        schedule,
        err instanceof Error ? err.message : 'Publishing failed'
      )
    }
  }

  return {
    processed: (schedules || []).length,
  }
}
