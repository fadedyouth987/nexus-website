import { ScheduledContentRunsListClient } from '@/components/dashboard/ScheduledContentRunsListClient'
import { getScheduledContentRuns } from '@/modules/scheduling'
import { requireAppSession } from '@/server/auth/session'

export default async function SchedulesPage() {
  const session = await requireAppSession()
  const schedules = await getScheduledContentRuns(session).catch(() => [])

  return <ScheduledContentRunsListClient initialSchedules={schedules} />
}
