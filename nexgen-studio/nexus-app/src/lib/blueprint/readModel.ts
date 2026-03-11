import { getBlueprintReadModel as readModelFromEnv } from './env'

export { getBlueprintReadModel } from './env'

function mapLegacyAsset(asset: any) {
  return {
    ...asset,
    type: typeof asset.type === 'string' ? asset.type.toUpperCase() : 'IMAGE',
    sfw_status: asset.sfw_status || 'SAFE',
    thumbnail_path: asset.thumbnail_path || asset.url || asset.storage_path || '',
    storage_path: asset.storage_path || asset.url || asset.thumbnail_path || '',
    meta: asset.meta || {},
  }
}

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

export async function listAssetsForTab(opts: {
  supabase: any
  userId: string
  orgId: string
  influencerId?: string
  visibility: 'STANDARD' | 'VAULT'
}) {
  const mode = readModelFromEnv()
  if (mode === 'legacy') {
    let query = opts.supabase
      .from('assets')
      .select('*')
      .eq('org_id', opts.orgId)
      .in('sfw_status', mapVisibilityToLegacyFilter(opts.visibility))
      .order('created_at', { ascending: false })

    if (opts.influencerId) {
      query = query.eq('influencer_id', opts.influencerId)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return (data ?? []).map(mapLegacyAsset)
  }

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

export async function getJob(opts: { supabase: any; userId: string; jobId: string }) {
  const mode = readModelFromEnv()
  if (mode === 'legacy') {
    const { data, error } = await opts.supabase
      .from('generations')
      .select(
        'id, creator_id, user_id, prompt, negative_prompt, model, status, error_message, parameters, created_at, updated_at'
      )
      .eq('id', opts.jobId)
      .eq('user_id', opts.userId)
      .maybeSingle()

    if (error) throw new Error(error.message)
    return data
  }

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

export async function listJobs(opts: { supabase: any; userId: string }) {
  const mode = readModelFromEnv()
  if (mode === 'legacy') {
    const { data, error } = await opts.supabase
      .from('generations')
      .select('id, creator_id, prompt, status, error_message, created_at, updated_at')
      .eq('user_id', opts.userId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  }

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
