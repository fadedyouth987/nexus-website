import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { getVideoJobs } from '@/modules/video-jobs'
import { createClient } from '@/lib/supabase/server'
import { getBlueprintReadModel, listJobs } from '@/lib/blueprint/readModel'

/**
 * Unified generation jobs API
 * Returns both durable video-jobs and legacy generation_jobs in a single list
 */
export async function GET() {
  const session = await requireAppSession()

  try {
    // Fetch durable video jobs
    const videoJobs = await getVideoJobs(session).catch(() => [])

    // Fetch legacy generation jobs (only if not using blueprint exec mode exclusively)
    let legacyJobs: unknown[] = []
    if (getBlueprintReadModel() !== 'exec') {
      const supabase = await createClient()
      try {
        legacyJobs = (await listJobs({ supabase, userId: session.userId })) ?? []
      } catch {
        // Legacy jobs are optional - don't fail if unavailable
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

    return NextResponse.json(unifiedJobs)
  } catch (error) {
    console.error('Failed to fetch unified generation jobs:', error)
    return NextResponse.json({ detail: 'Failed to load generation jobs' }, { status: 500 })
  }
}
