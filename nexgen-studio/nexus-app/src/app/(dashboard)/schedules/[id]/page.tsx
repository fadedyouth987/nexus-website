import { notFound } from 'next/navigation'
import { ScheduledContentRunDetailClient } from '@/components/dashboard/ScheduledContentRunDetailClient'
import { getScheduledContentRun } from '@/modules/scheduling'
import { requireAppSession } from '@/server/auth/session'

type ScheduleDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function ScheduledContentRunDetailPage({ params }: ScheduleDetailPageProps) {
  const session = await requireAppSession()
  const { id } = await params
  const detail = await getScheduledContentRun(session, id).catch(() => null)

  if (!detail) {
    notFound()
  }

  return <ScheduledContentRunDetailClient initialDetail={detail} />
}
