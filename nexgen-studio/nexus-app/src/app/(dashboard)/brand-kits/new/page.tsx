import { BrandKitForm } from '@/components/dashboard/forms/BrandKitForm'
import { requireAppSession } from '@/server/auth/session'
import { getDashboardFormOptions } from '../../_lib/dashboardOptions'

export default async function NewBrandKitPage() {
  const session = await requireAppSession()
  const options = await getDashboardFormOptions(session)
  return <BrandKitForm mode="create" projectOptions={options.projects} />
}
