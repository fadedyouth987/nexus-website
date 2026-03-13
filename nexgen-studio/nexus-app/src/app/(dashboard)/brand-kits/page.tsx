import { Palette } from 'lucide-react'
import { ResourceListCard } from '@/components/dashboard/ResourceListCard'
import { getBrandKits } from '@/modules/brand-kits'
import { requireAppSession } from '@/server/auth/session'

export default async function BrandKitsPage() {
  const session = await requireAppSession()
  const brandKits = await getBrandKits(session).catch(() => [])

  return (
    <ResourceListCard
      eyebrow="Brand Kits"
      title="Brand kits keep every generated frame aligned with voice, palette, and positioning."
      description="This domain replaces loose prompt memory and one-off styling. It gives campaigns and future automated content runs a stable brand source of truth."
      icon={Palette}
      actionHref="/brand-kits/new"
      actionLabel="New brand kit"
      items={brandKits.map((brandKit) => ({
        id: brandKit.id,
        title: brandKit.name,
        description: brandKit.voice_guidelines || brandKit.tone || 'Brand kit is ready to anchor campaigns and generation jobs.',
        meta: `${brandKit.palette.length} colors`,
        editHref: `/brand-kits/${brandKit.id}/edit`,
      }))}
    />
  )
}
