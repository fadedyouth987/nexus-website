import { requireAppSession, requireAdminRole } from '@/server/auth/session'
import { getQueueProvider } from '@/server/providers/queue'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import { QueueDashboardClient } from '@/components/admin/QueueDashboardClient'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Queue Dashboard',
  description: 'Real-time queue monitoring and stuck job management',
}

export default async function QueueDashboardPage() {
  const session = await requireAppSession()
  await requireAdminRole(session)

  // Fetch initial queue data server-side
  const queue = getQueueProvider()
  const admin = getSupabaseAdmin()

  const [nsfwImageDepth, sfwImageDepth, nsfwVideoDepth, sfwVideoDepth, videoJobsDepth] = await Promise.all([
    queue.depth('nsfw:generations:IMAGE'),
    queue.depth('sfw:generations:IMAGE'),
    queue.depth('nsfw:generations:VIDEO'),
    queue.depth('sfw:generations:VIDEO'),
    queue.depth('video:jobs'),
  ])

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const { data: stuckJobs } = await admin
    .from('generation_jobs')
    .select('id, status, created_at, updated_at, mode, content_policy, user_id, organization_id, error')
    .in('status', ['QUEUED', 'GENERATING'])
    .or(`heartbeat.is.null,heartbeat.lt.${fiveMinutesAgo}`)
    .order('updated_at', { ascending: true })
    .limit(50)

  const initialData = {
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
    timestamp: new Date().toISOString(),
  }

  return <QueueDashboardClient initialData={initialData} />
}
