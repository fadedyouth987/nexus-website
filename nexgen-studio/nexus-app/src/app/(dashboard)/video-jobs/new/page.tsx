import { VideoJobForm } from '@/components/dashboard/forms/VideoJobForm'
import { requireAppSession } from '@/server/auth/session'
import { getDashboardFormOptions } from '../../_lib/dashboardOptions'

export default async function NewVideoJobPage() {
  const session = await requireAppSession()
  const options = await getDashboardFormOptions(session)

  return (
    <VideoJobForm
      mode="create"
      projectOptions={options.projects}
      campaignOptions={options.campaigns}
      brandKitOptions={options.brandKits}
      influencerOptions={options.influencers}
      workflowOptions={options.workflowTemplates}
    />
  )
}
