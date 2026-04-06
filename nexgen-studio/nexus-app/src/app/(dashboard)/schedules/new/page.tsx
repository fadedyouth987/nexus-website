import { ScheduledContentRunForm } from '@/components/dashboard/forms/ScheduledContentRunForm'
import { requireAppSession } from '@/server/auth/session'
import { getDashboardFormOptions } from '../../_lib/dashboardOptions'

export default async function NewScheduledContentRunPage() {
  const session = await requireAppSession()
  const options = await getDashboardFormOptions(session)

  return (
    <ScheduledContentRunForm
      mode="create"
      projectOptions={options.projects}
      campaignOptions={options.campaigns}
      brandKitOptions={options.brandKits}
      influencerOptions={options.influencers}
      workflowOptions={options.workflowTemplates}
    />
  )
}
