import { getBlueprintSupabaseAdmin } from './supabaseAdmin'

export async function writeBlueprintAudit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
) {
  const admin = getBlueprintSupabaseAdmin()
  const { error } = await admin.from('blueprint_audit_logs').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata_json: metadata,
  })

  if (error) {
    console.error('Failed to write blueprint audit log:', error.message)
  }
}
