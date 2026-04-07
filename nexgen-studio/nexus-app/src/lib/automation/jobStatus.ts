import { createServiceClient } from '@/lib/supabase/service'

export async function getActiveOrgIdsForUser(userId: string): Promise<string[]> {
  const service = createServiceClient()
  const { data, error } = await service
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (error || !data?.length) return []
  return data.map((r) => r.org_id)
}

export type GenerationJob = {
  id: string
  org_id: string
  user_id: string
  influencer_id: string | null
  job_type: string
  input_params: Record<string, unknown>
  input_images: string[]
  status: string
  priority: number
  progress: number
  server_id: string | null
  comfyui_prompt_id: string | null
  output_images: string[]
  seed_used: number | null
  started_at: string | null
  completed_at: string | null
  processing_time_ms: number | null
  error_message: string | null
  retry_count: number
  idempotency_key: string | null
  priority_queue: 'critical' | 'high' | 'normal' | 'low'
  webhook_url: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type GenerationAsset = {
  id: string
  org_id: string
  user_id: string | null
  job_id: string
  url: string
  thumbnail_url: string | null
  file_type: string
  width: number | null
  height: number | null
  file_size_bytes: number | null
  prompt: string | null
  negative_prompt: string | null
  seed: number | null
  model_used: string | null
  generation_params: Record<string, unknown>
  safety_rating: string
  moderation_status: string
  is_favorite: boolean
  is_archived: boolean
  created_at: string
}

export async function getGenerationJobById(
  jobId: string,
  userId: string,
  options?: { orgIds?: string[] }
): Promise<GenerationJob | null> {
  const orgIds = options?.orgIds ?? (await getActiveOrgIdsForUser(userId))
  if (orgIds.length === 0) return null

  const service = createServiceClient()

  const { data: job, error } = await service
    .from('generation_jobs')
    .select(`
      id,
      org_id,
      user_id,
      influencer_id,
      job_type,
      input_params,
      input_images,
      status,
      priority,
      progress,
      server_id,
      comfyui_prompt_id,
      output_images,
      seed_used,
      started_at,
      completed_at,
      processing_time_ms,
      error_message,
      retry_count,
      idempotency_key,
      priority_queue,
      webhook_url,
      metadata,
      created_at,
      updated_at
    `)
    .eq('id', jobId)
    .in('org_id', orgIds)
    .single()

  if (error || !job) return null

  return {
    ...job,
    output_images: job.output_images ?? [],
    input_images: job.input_images ?? [],
    started_at: job.started_at ?? null,
    completed_at: job.completed_at ?? null,
    processing_time_ms: job.processing_time_ms ?? null,
    error_message: job.error_message ?? null,
    retry_count: job.retry_count ?? 0,
    idempotency_key: job.idempotency_key ?? null,
    priority_queue: job.priority_queue as 'critical' | 'high' | 'normal' | 'low' ?? 'normal',
    webhook_url: job.webhook_url ?? null,
    metadata: job.metadata ?? {},
  }
}

export async function getGenerationAssetsByJobId(
  jobId: string,
  userId: string,
  options?: { orgIds?: string[] }
): Promise<GenerationAsset[]> {
  const orgIds = options?.orgIds ?? (await getActiveOrgIdsForUser(userId))
  if (orgIds.length === 0) return []

  const service = createServiceClient()

  const { data: assets, error } = await service
    .from('generated_assets')
    .select(`
      id,
      org_id,
      user_id,
      job_id,
      url,
      thumbnail_url,
      file_type,
      width,
      height,
      file_size_bytes,
      prompt,
      negative_prompt,
      seed,
      model_used,
      generation_params,
      safety_rating,
      moderation_status,
      is_favorite,
      is_archived,
      created_at
    `)
    .eq('job_id', jobId)
    .in('org_id', orgIds)
    .order('created_at', { ascending: false })

  if (error || !assets) return []

  return assets as GenerationAsset[]
}

export async function updateGenerationJobProgress(
  jobId: string,
  progress: number,
  message?: string
): Promise<void> {
  const service = createServiceClient()
  await service
    .from('generation_jobs')
    .update({
      progress,
      ...(message !== undefined ? { error_message: message } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}

export async function updateGenerationJobStatus(
  jobId: string,
  status: string,
  options?: {
    errorMessage?: string
    outputImages?: string[]
    processingTimeMs?: number
    seedUsed?: number
  }
): Promise<void> {
  const service = createServiceClient()
  await service
    .from('generation_jobs')
    .update({
      status,
      ...(options?.errorMessage !== undefined ? { error_message: options.errorMessage } : {}),
      ...(options?.outputImages !== undefined ? { output_images: options.outputImages } : {}),
      ...(options?.processingTimeMs !== undefined ? { processing_time_ms: options.processingTimeMs } : {}),
      ...(options?.seedUsed !== undefined ? { seed_used: options.seedUsed } : {}),
      completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId)
}
