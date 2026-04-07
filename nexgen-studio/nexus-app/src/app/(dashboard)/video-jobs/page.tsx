import { UnifiedGenerationList } from '@/components/dashboard/UnifiedGenerationList'
import { requireAppSession } from '@/server/auth/session'
import { getVideoJobs } from '@/modules/video-jobs'
import { createClient } from '@/lib/supabase/server'
import { listJobs, getBlueprintReadModel } from '@/lib/blueprint/readModel'

export default async function VideoJobsPage() {
  const session = await requireAppSession()

  // Fetch both durable video jobs and legacy generation jobs
  const videoJobs = await getVideoJobs(session).catch(() => [])

  // Fetch legacy generation jobs (if not exclusively using blueprint exec mode)
  let legacyJobs: unknown[] = []
  if (getBlueprintReadModel() !== 'exec') {
    const supabase = await createClient()
    try {
      legacyJobs = (await listJobs({ supabase, userId: session.userId })) ?? []
    } catch {
      legacyJobs = []
    }
  }

  // Transform to unified format
  const unifiedJobs = [
    // Durable video jobs
    ...videoJobs.map((job) => ({
      id: job.id,
      source: 'durable' as const,
      job_kind: job.job_kind,
      title: job.title,
      brief: job.brief,
      status: job.status,
      progress: job.progress,
      retry_count: job.retry_count,
      failure_code: job.failure_code,
      error_message: job.error_message,
      created_at: job.created_at,
      diagnostics: job.diagnostics,
    })),

    // Legacy generation jobs
    ...(Array.isArray(legacyJobs)
      ? legacyJobs.map((job: any) => ({
          id: job.id,
          source: 'legacy' as const,
          mode: job.mode || 'IMAGE',
          prompt: job.prompt,
          status: job.status,
          created_at: job.created_at || job.createdAt,
          error_message: job.error_message || job.errorMessage,
        }))
      : []),
  ]

  // Sort by created_at descending
  unifiedJobs.sort((a, b) => {
    const dateA = new Date(a.created_at || 0).getTime()
    const dateB = new Date(b.created_at || 0).getTime()
    return dateB - dateA
  })

  return <UnifiedGenerationList initialJobs={unifiedJobs} />
}
