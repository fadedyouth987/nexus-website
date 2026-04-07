import { createServiceClient } from '@/lib/supabase/service'

export type JobRecoveryStatus = 'recovered' | 'no_interrupted_jobs' | 'error'

export interface RecoveryResult {
  status: JobRecoveryStatus
  recoveredCount: number
  failedCount: number
  details: Array<{ jobId: string; previousStatus: string; action: string; error?: string }>
}

export async function recoverInterruptedJobs(): Promise<RecoveryResult> {
  const service = createServiceClient()
  const result: RecoveryResult = {
    status: 'no_interrupted_jobs',
    recoveredCount: 0,
    failedCount: 0,
    details: [],
  }

  const { data: interruptedJobs, error: queryErr } = await service
    .from('generation_jobs')
    .select('id, status, org_id, user_id, input_params, started_at, retry_count, error_message')
    .in('status', ['processing', 'queued'])
    .lt('started_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .order('created_at', { ascending: true })

  if (queryErr || !interruptedJobs?.length) {
    return result
  }

  result.status = 'recovered'

  for (const job of interruptedJobs) {
    try {
      if (job.status === 'processing') {
        const retryCount = (job.retry_count ?? 0) + 1
        const maxAttempts = 3

        if (retryCount < maxAttempts) {
          await service
            .from('generation_jobs')
            .update({
              status: 'queued',
              retry_count: retryCount,
              error_message: `Job interrupted during processing (attempt ${retryCount}/${maxAttempts})`,
              progress: 0,
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)

          const { enqueueGenerationJob } = await import('@/lib/jobs/generationQueue')
          await enqueueGenerationJob(job.id)

          result.recoveredCount++
          result.details.push({
            jobId: job.id,
            previousStatus: 'processing',
            action: `requeued as attempt ${retryCount}/${maxAttempts}`,
          })
        } else {
          await service
            .from('generation_jobs')
            .update({
              status: 'failed',
              error_message: 'Job interrupted during processing and max retries exceeded',
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', job.id)

          result.failedCount++
          result.details.push({
            jobId: job.id,
            previousStatus: 'processing',
            action: 'moved to failed (max retries exceeded)',
          })
        }
      } else if (job.status === 'queued') {
        const { enqueueGenerationJob } = await import('@/lib/jobs/generationQueue')
        await enqueueGenerationJob(job.id)

        result.recoveredCount++
        result.details.push({
          jobId: job.id,
          previousStatus: 'queued',
          action: 're-enqueued',
        })
      }
    } catch (e) {
      result.failedCount++
      result.details.push({
        jobId: job.id,
        previousStatus: job.status,
        action: 'recovery_failed',
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  console.info(`[recovery] recovered ${result.recoveredCount} jobs, ${result.failedCount} failed`)
  return result
}
