import { notFound } from 'next/navigation'
import { ScheduledContentRunForm } from '@/components/dashboard/forms/ScheduledContentRunForm'
import { getScheduledContentRun } from '@/modules/scheduling'
import { requireAppSession } from '@/server/auth/session'
import { getDashboardFormOptions } from '../../../_lib/dashboardOptions'

type EditScheduledContentRunPageProps = {
  params: Promise<{ id: string }>
}

export default async function EditScheduledContentRunPage({ params }: EditScheduledContentRunPageProps) {
  const session = await requireAppSession()
  const { id } = await params
  const [detail, options] = await Promise.all([
    getScheduledContentRun(session, id).catch(() => null),
    getDashboardFormOptions(session),
  ])

  if (!detail) {
    notFound()
  }

  const inputs =
    detail.schedule.metadata.inputs && typeof detail.schedule.metadata.inputs === 'object'
      ? detail.schedule.metadata.inputs as Record<string, unknown>
      : {}

  return (
    <ScheduledContentRunForm
      mode="edit"
      projectOptions={options.projects}
      campaignOptions={options.campaigns}
      brandKitOptions={options.brandKits}
      influencerOptions={options.influencers}
      workflowOptions={options.workflowTemplates}
      initialValues={{
        id: detail.schedule.id,
        projectId: detail.schedule.project_id ?? undefined,
        brandKitId: detail.schedule.brand_kit_id ?? undefined,
        campaignId: detail.schedule.campaign_id ?? undefined,
        workflowTemplateId: detail.schedule.workflow_template_id ?? undefined,
        influencerId: detail.schedule.influencer_id ?? undefined,
        title: detail.schedule.title,
        brief: detail.schedule.brief,
        script: detail.schedule.script ?? '',
        frequency: detail.schedule.frequency,
        dayOfWeek: detail.schedule.day_of_week != null ? String(detail.schedule.day_of_week) : '1',
        timeOfDay: detail.schedule.time_of_day,
        timezone: detail.schedule.timezone,
        jobsPerRun: String(detail.schedule.jobs_per_run),
        provider: detail.schedule.provider,
        jobKind: detail.schedule.job_kind,
        prompt: typeof inputs.prompt === 'string' ? inputs.prompt : '',
        negativePrompt: typeof inputs.negative_prompt === 'string' ? inputs.negative_prompt : '',
        batchSize: typeof inputs.batch_size === 'number' ? String(inputs.batch_size) : '1',
        aspectRatio: typeof inputs.aspect_ratio === 'string' ? inputs.aspect_ratio : '9:16',
        durationSeconds: typeof inputs.duration_seconds === 'number' ? String(inputs.duration_seconds) : '10',
      }}
    />
  )
}
