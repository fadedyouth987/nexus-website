import type { AppSession } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import type { CreateUsageEventInput, UsageEventRecord } from './types'

const TABLE = 'usage_events'

function mapUsageEvent(row: Record<string, unknown>) {
  return {
    ...row,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata as Record<string, unknown> : {},
  } as UsageEventRecord
}

function usageEventPayload(input: CreateUsageEventInput) {
  return {
    org_id: input.orgId,
    user_id: input.userId ?? null,
    project_id: input.projectId ?? null,
    campaign_id: input.campaignId ?? null,
    video_job_id: input.videoJobId ?? null,
    generation_job_id: input.generationJobId ?? null,
    workflow_template_id: input.workflowTemplateId ?? null,
    event_name: input.eventName,
    job_kind: input.jobKind ?? null,
    provider: input.provider ?? null,
    units: input.units ?? 0,
    unit_type: input.unitType ?? 'credits',
    event_key: input.eventKey,
    metadata: input.metadata ?? {},
  }
}

function isMissingConflictConstraint(error: { code?: string; message?: string } | null) {
  return error?.code === '42P10'
}

export async function upsertUsageEvent(input: CreateUsageEventInput) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .upsert(usageEventPayload(input), {
      onConflict: 'event_key',
      ignoreDuplicates: false,
    })
    .select('*')
    .single()

  if (isMissingConflictConstraint(error)) {
    const { data: existing, error: existingError } = await admin
      .from(TABLE)
      .select('*')
      .eq('event_key', input.eventKey)
      .maybeSingle()

    if (existingError) {
      throw existingError
    }

    if (existing) {
      return mapUsageEvent(existing as Record<string, unknown>)
    }

    const { data: inserted, error: insertError } = await admin
      .from(TABLE)
      .insert(usageEventPayload(input))
      .select('*')
      .single()

    if (insertError) {
      throw insertError
    }

    return mapUsageEvent(inserted as Record<string, unknown>)
  }

  if (error) {
    throw error
  }

  return mapUsageEvent(data as Record<string, unknown>)
}

export async function listUsageEvents(session: AppSession, from: string, to: string) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from(TABLE)
    .select('*')
    .eq('org_id', session.orgId)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map(mapUsageEvent)
}
