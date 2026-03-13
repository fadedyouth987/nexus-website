import { isBlueprintMirrorEnabled } from '../env'
import { writeActivityLog } from '../../server/activityLog'

function blueprintJobAssetKey(jobId: string, kind: string, variant: string) {
  return `${jobId}:${kind}:${variant}`
}

export async function mirrorGeneratedAssetToLegacy(opts: {
  admin: any
  job: any
  asset: any
}) {
  if (!isBlueprintMirrorEnabled()) return

  const bridgeKey = blueprintJobAssetKey(opts.job.id, opts.asset.kind, opts.asset.asset_variant || 'main')

  const legacyAsset = {
    org_id: opts.job.organization_id,
    influencer_id: opts.job.influencer_id,
    type: opts.asset.kind,
    sfw_status: opts.asset.visibility === 'VAULT' ? 'EXPLICIT' : 'SAFE',
    thumbnail_path: opts.asset.thumb_storage_url || opts.asset.storage_url,
    storage_path: opts.asset.storage_url,
    url: opts.asset.storage_url,
    meta: opts.asset.metadata_json || {},
    blueprint_job_asset_key: bridgeKey,
  }

  const { data: mirroredAsset, error } = await opts.admin
    .from('assets')
    .upsert(legacyAsset, { onConflict: 'blueprint_job_asset_key' })
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('Failed to mirror generated asset to legacy:', error.message)
    await writeActivityLog({
      supabase: opts.admin,
      orgId: opts.job.organization_id,
      actorId: opts.job.user_id,
      action: 'legacy.asset_mirror_failed',
      entityType: 'generation_job',
      entityId: opts.job.id,
      metadata: {
        asset_kind: opts.asset.kind,
        asset_variant: opts.asset.asset_variant || 'main',
        error_message: error.message,
        source: 'blueprint.mirror_to_legacy',
      },
    })
    return
  }

  await writeActivityLog({
    supabase: opts.admin,
    orgId: opts.job.organization_id,
    actorId: opts.job.user_id,
    action: 'legacy.asset_mirrored',
    entityType: 'asset',
    entityId: mirroredAsset?.id || null,
    metadata: {
      generation_job_id: opts.job.id,
      influencer_id: opts.job.influencer_id,
      kind: opts.asset.kind,
      asset_variant: opts.asset.asset_variant || 'main',
      source: 'blueprint.mirror_to_legacy',
    },
  })
}

export async function mirrorJobStatusToLegacy(opts: {
  admin: any
  job: any
}) {
  if (!isBlueprintMirrorEnabled()) return

  const legacyStatus =
    opts.job.status === 'QUEUED'
      ? 'queued'
      : opts.job.status === 'GENERATING'
        ? 'in_progress'
        : opts.job.status === 'READY'
          ? 'completed'
          : opts.job.status === 'CANCELED'
            ? 'failed'
          : opts.job.status === 'FAILED'
            ? 'failed'
            : 'queued'

  const payload = {
    id: opts.job.id,
    user_id: opts.job.user_id,
    creator_id: opts.job.influencer_id,
    prompt: opts.job.inputs_json?.prompt || '',
    negative_prompt: opts.job.inputs_json?.negative_prompt || '',
    model: opts.job.inputs_json?.checkpoint || 'sd15',
    status: legacyStatus,
    error_message: opts.job.error || null,
    parameters: opts.job.inputs_json || {},
  }

  const { error } = await opts.admin.from('generations').upsert(payload)
  if (error) {
    console.error('Failed to mirror generation job to legacy:', error.message)
    await writeActivityLog({
      supabase: opts.admin,
      orgId: opts.job.organization_id,
      actorId: opts.job.user_id,
      action: 'legacy.generation_mirror_failed',
      entityType: 'generation_job',
      entityId: opts.job.id,
      metadata: {
        status: opts.job.status,
        error_message: error.message,
        source: 'blueprint.mirror_to_legacy',
      },
    })
    return
  }

  await writeActivityLog({
    supabase: opts.admin,
    orgId: opts.job.organization_id,
    actorId: opts.job.user_id,
    action: 'legacy.generation_mirrored',
    entityType: 'generation_job',
    entityId: opts.job.id,
    metadata: {
      status: opts.job.status,
      legacy_status: legacyStatus,
      source: 'blueprint.mirror_to_legacy',
    },
  })
}
