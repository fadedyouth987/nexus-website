import { Image } from 'lucide-react'
import { ResourceListCard } from '@/components/dashboard/ResourceListCard'
import { getAssets } from '@/modules/assets'
import { requireAppSession } from '@/server/auth/session'

export default async function AssetsPage() {
  const session = await requireAppSession()
  const assets = await getAssets(session).catch(() => [])

  return (
    <ResourceListCard
      eyebrow="Assets"
      title="Generated assets are now a product domain, not just a gallery view."
      description="Assets are attached to async jobs and campaign outcomes so the dashboard can evolve toward approvals, publishing, and recurring automation without file sprawl."
      icon={Image}
      actionHref="/gallery"
      actionLabel="Open gallery"
      items={assets.map((asset) => ({
        id: asset.id,
        title: asset.kind,
        description: asset.storage_url || 'Generated asset linked to a job output.',
        meta: new Date(asset.created_at).toLocaleDateString(),
      }))}
    />
  )
}
