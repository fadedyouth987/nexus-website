import { NextResponse } from 'next/server'
import { requireAppSession, requireAdminRole } from '@/server/auth/session'
import { getQueueProvider } from '@/server/providers/queue'
import { getSupabaseAdmin } from '@/server/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/queue - Admin queue dashboard data
 * Returns real-time queue depth, stuck jobs, and processing stats
 */
export async function GET() {
  const session = await requireAppSession()
  await requireAdminRole(session)

  try {
    const queue = getQueueProvider()
    const admin = getSupabaseAdmin()

    // Get queue depths from Redis
    const [nsfwImageDepth, sfwImageDepth, nsfwVideoDepth, sfwVideoDepth] = await Promise.all([
      queue.depth('nsfw:generations:IMAGE'),
      queue.depth('sfw:generations:IMAGE'),
      queue.depth('nsfw:generations:VIDEO'),
      queue.depth('sfw:generations:VIDEO'),
    ])

    const videoJobsDepth = await queue.depth('video:jobs')

    // Get stuck jobs (no heartbeat for > 5 minutes, not in terminal state)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: stuckJobs, error: stuckError } = await admin
      .from('generation_jobs')
      .select('id, status, created_at, updated_at, mode, content_policy, user_id, organization_id')
      .in('status', ['QUEUED', 'GENERATING'])
      .or(`heartbeat.is.null,heartbeat.lt.${fiveMinutesAgo}`)
      .order('updated_at', { ascending: true })
      .limit(50)

    if (stuckError) {
      console.error('Failed to fetch stuck jobs:', stuckError.message)
    }

    // Get recent job stats by status
    type JobStatus = { status: string }
    const { data: statusCounts, error: countsError } = await admin
      .from('generation_jobs')
      .select('status')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    if (countsError) {
      console.error('Failed to fetch status counts:', countsError.message)
    }

    const counts = statusCounts as JobStatus[] | null
    const stats = {
      last24h: {
        total: counts?.length || 0,
        queued: counts?.filter((j: JobStatus) => j.status === 'QUEUED').length || 0,
        generating: counts?.filter((j: JobStatus) => j.status === 'GENERATING').length || 0,
        completed: counts?.filter((j: JobStatus) => j.status === 'READY').length || 0,
        failed: counts?.filter((j: JobStatus) => j.status === 'FAILED').length || 0,
        cancelled: counts?.filter((j: JobStatus) => j.status === 'CANCELED').length || 0,
      },
    }

    // Get processing rate (jobs completed in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentCompleted, error: rateError } = await admin
      .from('generation_jobs')
      .select('id, updated_at')
      .eq('status', 'READY')
      .gte('updated_at', oneHourAgo)
      .order('updated_at', { ascending: false })

    if (rateError) {
      console.error('Failed to fetch processing rate:', rateError.message)
    }

    const jobsPerHour = recentCompleted?.length || 0
    const avgProcessingTimeMs =
      recentCompleted && recentCompleted.length > 1
        ? calculateAvgProcessingTime(recentCompleted)
        : null

    return NextResponse.json({
      queues: {
        generations: {
          nsfw: {
            image: nsfwImageDepth,
            video: nsfwVideoDepth,
          },
          sfw: {
            image: sfwImageDepth,
            video: sfwVideoDepth,
          },
          total: nsfwImageDepth + sfwImageDepth + nsfwVideoDepth + sfwVideoDepth,
        },
        videoJobs: videoJobsDepth,
      },
      stuckJobs: stuckJobs || [],
      stats,
      throughput: {
        jobsPerHour,
        avgProcessingTimeSeconds: avgProcessingTimeMs ? Math.round(avgProcessingTimeMs / 1000) : null,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Admin queue dashboard error:', error)
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load queue data' },
      { status: 500 }
    )
  }
}

function calculateAvgProcessingTime(jobs: Array<{ updated_at: string }>): number {
  // Estimate processing time based on completion timestamps
  // This is a rough estimate assuming jobs started uniformly
  if (jobs.length < 2) return 0

  const times = jobs.map((j) => new Date(j.updated_at).getTime())
  const min = Math.min(...times)
  const max = Math.max(...times)
  const span = max - min

  // Average time per job = span / count
  return span / jobs.length
}
