import { notFound } from 'next/navigation'
import { VideoJobForm } from '@/components/dashboard/forms/VideoJobForm'
import { requireAppSession } from '@/server/auth/session'
import { getVideoJobDetail } from '@/modules/video-jobs/repository'
import { getDashboardFormOptions } from '../../../_lib/dashboardOptions'

export default async function EditVideoJobPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAppSession()
  const { id } = await params
  const [detail, options] = await Promise.all([
    getVideoJobDetail(session, id),
    getDashboardFormOptions(session),
  ])

  if (!detail) {
    notFound()
  }

  const metadata = detail.job.metadata ?? {}
  const inputs = metadata.inputs && typeof metadata.inputs === 'object'
    ? metadata.inputs as Record<string, unknown>
    : {}

  return (
    <VideoJobForm
      mode="edit"
      projectOptions={options.projects}
      campaignOptions={options.campaigns}
      brandKitOptions={options.brandKits}
      influencerOptions={options.influencers}
      workflowOptions={options.workflowTemplates}
      initialValues={{
        id: detail.job.id,
        jobKind: detail.job.job_kind,
        projectId: detail.job.project_id ?? undefined,
        campaignId: detail.job.campaign_id ?? undefined,
        brandKitId: detail.job.brand_kit_id ?? undefined,
        title: detail.job.title,
        brief: detail.job.brief,
        script: detail.job.script ?? '',
        provider: detail.job.provider,
        workflowTemplateId: typeof metadata.workflowTemplateId === 'string' ? metadata.workflowTemplateId : undefined,
        influencerId: typeof metadata.influencerId === 'string' ? metadata.influencerId : undefined,
        prompt: typeof inputs.prompt === 'string' ? inputs.prompt : '',
        negativePrompt: typeof inputs.negative_prompt === 'string' ? inputs.negative_prompt : '',
        batchSize: String(typeof inputs.batch_size === 'number' ? inputs.batch_size : 1),
        aspectRatio: typeof inputs.aspect_ratio === 'string' ? inputs.aspect_ratio : '9:16',
        durationSeconds: String(typeof inputs.duration_seconds === 'number' ? inputs.duration_seconds : 10),
      }}
    />
  )
}
