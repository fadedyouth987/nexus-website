import { CampaignForm } from '@/components/dashboard/forms/CampaignForm'
import { requireAppSession } from '@/server/auth/session'
import { getDashboardFormOptions } from '../../_lib/dashboardOptions'

export default async function NewCampaignPage() {
  const session = await requireAppSession()
  const options = await getDashboardFormOptions(session)

  return (
    <CampaignForm
      mode="create"
      projectOptions={options.projects}
      brandKitOptions={options.brandKits}
    />
  )
}
