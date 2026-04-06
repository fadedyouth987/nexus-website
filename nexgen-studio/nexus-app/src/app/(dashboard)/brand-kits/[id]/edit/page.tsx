import { notFound } from 'next/navigation'
import { BrandKitForm } from '@/components/dashboard/forms/BrandKitForm'
import { requireAppSession } from '@/server/auth/session'
import { getBrandKit } from '@/modules/brand-kits'
import { getDashboardFormOptions } from '../../../_lib/dashboardOptions'

export default async function EditBrandKitPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAppSession()
  const { id } = await params
  const [brandKit, options] = await Promise.all([
    getBrandKit(session, id),
    getDashboardFormOptions(session),
  ])

  if (!brandKit) {
    notFound()
  }

  return (
    <BrandKitForm
      mode="edit"
      projectOptions={options.projects}
      initialValues={{
        id: brandKit.id,
        projectId: brandKit.project_id ?? undefined,
        name: brandKit.name,
        tone: brandKit.tone ?? '',
        palette: brandKit.palette.join(', '),
        typography: brandKit.typography.join(', '),
        voiceGuidelines: brandKit.voice_guidelines ?? '',
      }}
    />
  )
}
