import { notFound } from 'next/navigation'
import { requireAppSession } from '@/server/auth/session'
import { getVideoJobById } from '@/modules/video-jobs'
import { VideoJobDetailClient } from '@/components/dashboard/VideoJobDetailClient'

export default async function VideoJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAppSession()
  const { id } = await params
  const detail = await getVideoJobById(session, id).catch(() => null)

  if (!detail) {
    notFound()
  }

  return <VideoJobDetailClient initialData={detail} />
}
