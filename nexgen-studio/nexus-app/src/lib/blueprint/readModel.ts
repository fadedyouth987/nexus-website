/**
 * Blueprint Read Model - DEPRECATED LEGACY PATHS REMOVED
 *
 * This module now ONLY uses the exec (generation_jobs) tables as source of truth.
 * Legacy table access has been removed in v1.5+.
 *
 * For apps still on legacy data, enable BLUEPRINT_MIRROR_LEGACY=1 to keep
 * generation_jobs mirrored to legacy tables for read compatibility.
 *
 * MIGRATION PATH:
 * 1. Ensure BLUEPRINT_MIRROR_LEGACY=1 is enabled
 * 2. Verify data integrity in generation_jobs
 * 3. Update downstream consumers to read from generation_jobs
 * 4. Disable mirroring when ready
 */

import { getBlueprintReadModel as readModelFromEnv } from './env'

export { getBlueprintReadModel } from './env'

// EXEC MODE ASSET MAPPING (source of truth)
function mapExecAsset(asset: any) {
  return {
    id: asset.id,
    influencer_id: asset.influencer_id,
    type: asset.kind,
    sfw_status: asset.visibility === 'VAULT' ? 'EXPLICIT' : 'SAFE',
    thumbnail_path: asset.thumb_storage_url || asset.storage_url,
    storage_path: asset.storage_url,
    meta: asset.metadata_json || {},
    visibility: asset.visibility,
    created_at: asset.created_at,
  }
}

// EXEC MODE JOB MAPPING (source of truth)
function mapExecJob(job: any, asset?: any) {
  return {
    id: job.id,
    creator_id: job.influencer_id,
    prompt: job.inputs_json?.prompt || '',
    status:
      job.status === 'QUEUED'
        ? 'pending'
        : job.status === 'GENERATING'
          ? 'in_progress'
          : job.status === 'READY'
            ? 'completed'
            : job.status === 'FAILED'
              ? 'failed'
              : job.status === 'CANCELED'
                ? 'failed'
                : String(job.status || '').toLowerCase(),
    error_message: job.error || null,
    created_at: job.created_at,
    updated_at: job.updated_at,
    parameters: job.inputs_json || {},
    result: asset
      ? {
          asset_id: asset.id,
          image_path: asset.kind === 'IMAGE' ? asset.storage_url : null,
          video_path: asset.kind === 'VIDEO' ? asset.storage_url : null,
        }
      : { asset_id: null, image_path: null, video_path: null },
  }
}

function mapVisibilityToLegacyFilter(visibility: 'STANDARD' | 'VAULT') {
  return visibility === 'VAULT' ? ['EXPLICIT'] : ['SAFE', 'SUGGESTIVE']
}

/**
 * List assets for gallery/vault tabs
 * Reads from generated_assets (exec mode - source of truth)
 */
export async function listAssetsForTab(opts: {
  supabase: any
  userId: string
  orgId: string
  influencerId?: string
  visibility: 'STANDARD' | 'VAULT'
}) {
  // EXEC MODE ONLY - legacy path removed in v1.5
  let query = opts.supabase
    .from('generated_assets')
    .select('*')
    .eq('organization_id', opts.orgId)
    .eq('visibility', opts.visibility)
    .order('created_at', { ascending: false })

  if (opts.influencerId) {
    query = query.eq('influencer_id', opts.influencerId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapExecAsset)
}

/**
 * Get single job by ID
 * Reads from generation_jobs (exec mode - source of truth)
 */
export async function getJob(opts: { supabase: any; userId: string; jobId: string }) {
  const { data: job, error } = await opts.supabase
    .from('generation_jobs')
    .select('*')
    .eq('id', opts.jobId)
    .eq('user_id', opts.userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!job) return null

  const { data: assets } = await opts.supabase
    .from('generated_assets')
    .select('*')
    .eq('generation_job_id', job.id)
    .order('created_at', { ascending: true })

  return mapExecJob(job, assets?.[0])
}

/**
 * List jobs for user
 * Reads from generation_jobs (exec mode - source of truth)
 */
export async function listJobs(opts: { supabase: any; userId: string }) {
  const { data: jobs, error } = await opts.supabase
    .from('generation_jobs')
    .select('*')
    .eq('user_id', opts.userId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!jobs?.length) return []

  const jobIds = jobs.map((job: any) => job.id)
  const { data: assets } = await opts.supabase
    .from('generated_assets')
    .select('*')
    .in('generation_job_id', jobIds)
    .order('created_at', { ascending: true })

  const firstAssetByJob = new Map<string, any>()
  for (const asset of assets ?? []) {
    if (!firstAssetByJob.has(asset.generation_job_id)) {
      firstAssetByJob.set(asset.generation_job_id, asset)
    }
  }

  return jobs.map((job: any) => mapExecJob(job, firstAssetByJob.get(job.id)))
}
