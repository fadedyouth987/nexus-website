type ActivityLogInput = {
  supabase: any
  orgId: string
  workspaceId?: string | null
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}

export async function writeActivityLog(input: ActivityLogInput) {
  const { error } = await input.supabase.from('activity_log').insert({
    org_id: input.orgId,
    workspace_id: input.workspaceId ?? null,
    actor_id: input.actorId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: input.metadata ?? {},
  })

  if (error) {
    // Audit logging is best-effort to avoid blocking core mutations during phased rollout.
    console.warn('Failed to write activity_log:', error.message)
  }
}
