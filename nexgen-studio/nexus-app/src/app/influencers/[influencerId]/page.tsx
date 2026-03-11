import { redirect } from 'next/navigation'

export default async function InfluencerDetailPage({
  params,
}: {
  params: Promise<{ influencerId: string }>
}) {
  const { influencerId } = await params
  redirect(`/creators/${influencerId}`)
}
