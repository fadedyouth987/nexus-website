import { createServiceClient } from '@/lib/supabase/service'
import { publishJobUpdate } from '@/lib/ws/jobBroadcast'

export type DLQEntry = {
  id: string
  original_job_id: string
  org_id: string | null
  user_id: string | null
  queue_name: string
  error_type: string | null
  error_message: string
  error_stack: string | null
  attempt_count: number
  max_attempts: number
  original_payload: Record<string, unknown>
  last_attempt_at: string | null
  replay_status: 'pending' | 'replaying' | 'replayed' | 'discarded'
  replayed_job_id: string | null
  replayed_at: string | null
  created_at: string
}

export async function moveToDeadLetterQueue(
  jobId: string,
  orgId: string,
  userId: string,
  error: Error,
  originalPayload: Record<string, unknown>,
  attemptCount: number,
  maxAttempts: number
): Promise<string> {
  const service = createServiceClient()

  const { data, error: insertErr } = await service
    .from('dead_letter_jobs')
    .insert({
      original_job_id: jobId,
      org_id: orgId,
      user_id: userId,
      queue_name: 'generation-jobs',
      error_type: error.name,
      error_message: error.message,
      error_stack: error.stack ?? null,
      attempt_count: attemptCount,
      max_attempts: maxAttempts,
      original_payload: originalPayload,
      last_attempt_at: new Date().toISOString(),
      replay_status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr) {
    console.error('[dlq] failed to insert dead letter entry', insertErr)
    throw insertErr
  }

  await publishJobUpdate(jobId, {
    type: 'dead_lettered',
    message: `Job moved to dead letter queue after ${attemptCount} attempts`,
    dlqId: data.id,
  })

  console.warn(`[dlq] job ${jobId} moved to DLQ (${data.id}) after ${attemptCount} attempts: ${error.message}`)
  return data.id
}

export async function replayDeadLetterJob(
  dlqId: string,
  replayedBy?: string
): Promise<{ replayedJobId: string }> {
  const service = createServiceClient()

  const { data: dlqEntry } = await service
    .from('dead_letter_jobs')
    .select('*')
    .eq('id', dlqId)
    .single()

  if (!dlqEntry) {
    throw new Error(`DLQ entry ${dlqId} not found`)
  }

  if (dlqEntry.replay_status !== 'pending') {
    throw new Error(`DLQ entry ${dlqId} is not in pending state (current: ${dlqEntry.replay_status})`)
  }

  await service
    .from('dead_letter_jobs')
    .update({ replay_status: 'replaying', updated_at: new Date().toISOString() })
    .eq('id', dlqId)

  const { data: job, error: jobErr } = await service
    .from('generation_jobs')
    .insert({
      org_id: dlqEntry.org_id,
      user_id: dlqEntry.user_id,
      job_type: 'image',
      input_params: dlqEntry.original_payload,
      status: 'queued',
      priority_queue: 'high',
      metadata: { replayed_from_dlq: dlqId, replayed_by: replayedBy },
    })
    .select('id')
    .single()

  if (jobErr || !job?.id) {
    await service
      .from('dead_letter_jobs')
      .update({ replay_status: 'pending', updated_at: new Date().toISOString() })
      .eq('id', dlqId)
    throw new Error(`Failed to create replay job: ${jobErr?.message}`)
  }

  await service
    .from('dead_letter_jobs')
    .update({
      replay_status: 'replayed',
      replayed_job_id: job.id,
      replayed_at: new Date().toISOString(),
      replayed_by: replayedBy ?? null,
    })
    .eq('id', dlqId)

  const { enqueueGenerationJob } = await import('@/lib/jobs/generationQueue')
  await enqueueGenerationJob(job.id)

  return { replayedJobId: job.id }
}

export async function discardDeadLetterJob(dlqId: string): Promise<void> {
  const service = createServiceClient()
  await service
    .from('dead_letter_jobs')
    .update({ replay_status: 'discarded', updated_at: new Date().toISOString() })
    .eq('id', dlqId)
}

export async function getDeadLetterJobs(orgId: string, options?: { limit?: number; offset?: number; status?: string }): Promise<DLQEntry[]> {
  const service = createServiceClient()
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  let query = service
    .from('dead_letter_jobs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (options?.status) {
    query = query.eq('replay_status', options.status)
  }

  const { data } = await query
  return (data ?? []) as DLQEntry[]
}

export async function getDeadLetterJobCount(orgId: string): Promise<{ pending: number; replayed: number; discarded: number }> {
  const service = createServiceClient()

  const { data: pending } = await service
    .from('dead_letter_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('replay_status', 'pending')

  const { data: replayed } = await service
    .from('dead_letter_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('replay_status', 'replayed')

  const { data: discarded } = await service
    .from('dead_letter_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('replay_status', 'discarded')

  return {
    pending: pending?.length ?? 0,
    replayed: replayed?.length ?? 0,
    discarded: discarded?.length ?? 0,
  }
}
