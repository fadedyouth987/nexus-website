import { VideoJobsListClient } from '@/components/dashboard/VideoJobsListClient'
import { getVideoJobs } from '@/modules/video-jobs'
import { requireAppSession } from '@/server/auth/session'

export default async function VideoJobsPage() {
  const session = await requireAppSession()
  const jobs = await getVideoJobs(session).catch(() => [])

  return <VideoJobsListClient initialJobs={jobs} />
}
