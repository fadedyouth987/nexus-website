import { notFound } from 'next/navigation'
import { CampaignForm } from '@/components/dashboard/forms/CampaignForm'
import { requireAppSession } from '@/server/auth/session'
import { getCampaign } from '@/modules/campaigns'
import { getDashboardFormOptions } from '../../../_lib/dashboardOptions'

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAppSession()
  const { id } = await params
  const [campaign, options] = await Promise.all([
    getCampaign(session, id),
    getDashboardFormOptions(session),
  ])

  if (!campaign) {
    notFound()
  }

  return (
    <CampaignForm
      mode="edit"
      projectOptions={options.projects}
      brandKitOptions={options.brandKits}
      initialValues={{
        id: campaign.id,
        projectId: campaign.project_id ?? undefined,
        brandKitId: campaign.brand_kit_id ?? undefined,
        name: campaign.name,
        brief: campaign.brief,
        objective: campaign.objective ?? '',
        channel: campaign.channel ?? '',
        status: campaign.status,
      }}
    />
  )
}
