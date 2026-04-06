import { BriefcaseBusiness } from 'lucide-react'
import { ResourceListCard } from '@/components/dashboard/ResourceListCard'
import { getCampaigns } from '@/modules/campaigns'
import { requireAppSession } from '@/server/auth/session'

export default async function CampaignsPage() {
  const session = await requireAppSession()
  const campaigns = await getCampaigns(session).catch(() => [])

  return (
    <ResourceListCard
      eyebrow="Campaigns"
      title="Campaigns convert strategy into executable briefs for images, video, and distribution."
      description="This is the missing middle layer between brand setup and generation jobs. It makes future approvals, recurring runs, and scheduling workflows much easier to extend."
      icon={BriefcaseBusiness}
      actionHref="/campaigns/new"
      actionLabel="New campaign"
      items={campaigns.map((campaign) => ({
        id: campaign.id,
        title: campaign.name,
        description: campaign.brief,
        meta: campaign.status,
        editHref: `/campaigns/${campaign.id}/edit`,
      }))}
    />
  )
}
