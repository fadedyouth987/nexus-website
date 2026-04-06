import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSupabaseAdmin } from '@/server/supabase/admin'
import type { AppSession } from '@/server/auth/session'
import { createProjectRecord } from '@/modules/projects'
import { createBrandKitRecord } from '@/modules/brand-kits'
import { createCampaignRecord } from '@/modules/campaigns'
import {
  createScheduledContentRunRecord,
  getScheduledContentRun,
  runScheduledContentRunNow,
} from '@/modules/scheduling'
import { getGenerationUsageMetrics } from '@/modules/usage-events'
import { getAssets } from '@/modules/assets'

type WorkflowTemplate = {
  id: string
  slug: string
  type: 'IMAGE' | 'VIDEO'
}

type FixtureContext = {
  session: AppSession
  influencerId: string
  imageWorkflowTemplateId: string
  videoWorkflowTemplateId: string
  projectId: string
  brandKitId: string
  imageCampaignId: string
  videoCampaignId: string
}

const TEST_USER_ID = 'b89b50ed-f762-45ef-a901-21be758b811d'

function isoNowOffset(minutes: number) {
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

function timeOfDay(minutesFromNow: number) {
  const date = new Date(Date.now() + minutesFromNow * 60_000)
  return date.toISOString().slice(11, 16)
}

function todayDayOfWeek() {
  return new Date().getUTCDay()
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function ensureWorkflowTemplate(slug: string, type: 'IMAGE' | 'VIDEO') {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('workflow_templates')
    .select('id, slug, type')
    .eq('slug', slug)
    .eq('type', type)
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) {
    throw new Error(`Missing active workflow template for ${slug}`)
  }

  return data as WorkflowTemplate
}

async function ensureOrgForUser(userId: string) {
  const admin = getSupabaseAdmin()

  const { data: existingMember } = await admin
    .from('org_members_v2')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (existingMember?.org_id) {
    return String(existingMember.org_id)
  }

  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name: 'Codex Smoke Org',
    })
    .select('id')
    .single()

  if (orgError || !org?.id) {
    throw new Error(orgError?.message || 'Failed to create smoke org')
  }

  const orgId = String(org.id)

  const { error: v2Error } = await admin
    .from('org_members_v2')
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        role: 'owner',
      },
      { onConflict: 'org_id,user_id' }
    )

  if (v2Error) {
    throw new Error(`Failed to create v2 org membership: ${v2Error.message}`)
  }

  const { data: existingLegacyMember, error: existingLegacyMemberError } = await admin
    .from('organization_members')
    .select('id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (existingLegacyMemberError) {
    throw new Error(`Failed to read legacy org membership: ${existingLegacyMemberError.message}`)
  }

  if (!existingLegacyMember?.id) {
    const legacyInsert = await admin
      .from('organization_members')
      .insert({
        org_id: orgId,
        user_id: userId,
        role: 'owner',
      })

    if (legacyInsert.error) {
      throw new Error(`Failed to create legacy org membership: ${legacyInsert.error.message}`)
    }
  }

  return orgId
}

async function ensureInfluencer(orgId: string) {
  const admin = getSupabaseAdmin()
  const handle = 'codex-smoke'

  const { data: existing } = await admin
    .from('influencers')
    .select('id')
    .eq('org_id', orgId)
    .eq('handle', handle)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return String(existing.id)
  }

  const { data, error } = await admin
    .from('influencers')
    .insert({
      org_id: orgId,
      name: 'Codex Smoke Influencer',
      handle,
      niche: 'automation',
      is_active: true,
      safety_lock: true,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(error?.message || 'Failed to create smoke influencer')
  }

  return String(data.id)
}

async function buildFixtureContext(): Promise<FixtureContext> {
  const orgId = await ensureOrgForUser(TEST_USER_ID)
  const influencerId = await ensureInfluencer(orgId)
  const imageWorkflow = await ensureWorkflowTemplate('sfw-txt2img-v1', 'IMAGE')
  const videoWorkflow = await ensureWorkflowTemplate('sfw-video-v1', 'VIDEO')

  const session: AppSession = {
    userId: TEST_USER_ID,
    email: 'nexgencompanion@gmail.com',
    name: 'Codex Smoke',
    orgId,
  }

  const seed = Date.now()
  const project = await createProjectRecord(session, {
    name: `Smoke Project ${seed}`,
    description: 'Smoke test project for scheduled durable generation.',
    objective: 'Validate scheduled content runs against the durable job backbone.',
    status: 'active',
  })

  const brandKit = await createBrandKitRecord(session, {
    projectId: project.id,
    name: `Smoke Brand Kit ${seed}`,
    tone: 'Premium, direct, modern',
    palette: ['#111827', '#0F766E', '#F59E0B'],
    typography: ['Space Grotesk', 'IBM Plex Sans'],
    voiceGuidelines: 'Keep prompts crisp, premium, and creator-focused.',
  })

  const imageCampaign = await createCampaignRecord(session, {
    projectId: project.id,
    brandKitId: brandKit.id,
    name: `Smoke Image Campaign ${seed}`,
    brief: 'Create a premium vertical product image for an AI creator platform.',
    channel: 'instagram',
    objective: 'Test scheduled image generation.',
    status: 'ready',
  })

  const videoCampaign = await createCampaignRecord(session, {
    projectId: project.id,
    brandKitId: brandKit.id,
    name: `Smoke Video Campaign ${seed}`,
    brief: 'Create a short premium teaser video for an AI creator platform.',
    channel: 'tiktok',
    objective: 'Test scheduled video generation.',
    status: 'ready',
  })

  return {
    session,
    influencerId,
    imageWorkflowTemplateId: imageWorkflow.id,
    videoWorkflowTemplateId: videoWorkflow.id,
    projectId: project.id,
    brandKitId: brandKit.id,
    imageCampaignId: imageCampaign.id,
    videoCampaignId: videoCampaign.id,
  }
}

async function createSchedule(
  fixture: FixtureContext,
  input: {
    title: string
    brief: string
    jobKind: 'image' | 'video'
    campaignId: string
    workflowTemplateId: string
    influencerId: string
    script?: string
  }
) {
  return createScheduledContentRunRecord(fixture.session, {
    projectId: fixture.projectId,
    brandKitId: fixture.brandKitId,
    campaignId: input.campaignId,
    workflowTemplateId: input.workflowTemplateId,
    influencerId: input.influencerId,
    title: input.title,
    brief: input.brief,
    script: input.script,
    frequency: 'daily',
    timeOfDay: timeOfDay(15),
    timezone: 'Australia/Adelaide',
    jobsPerRun: 1,
    provider: 'comfyui',
    jobKind: input.jobKind,
    inputs: {
      prompt: input.brief,
      batch_size: 1,
      aspect_ratio: '9:16',
      duration_seconds: input.jobKind === 'video' ? 4 : undefined,
    },
  })
}

async function waitForJobs(jobIds: string[], timeoutMs: number) {
  const admin = getSupabaseAdmin()
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const { data, error } = await admin
      .from('video_jobs')
      .select('*')
      .in('id', jobIds)
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    const jobs = (data ?? []) as Array<Record<string, unknown>>
    if (
      jobs.length === jobIds.length &&
      jobs.every((job) => ['completed', 'failed', 'cancelled'].includes(String(job.status)))
    ) {
      return jobs
    }

    await sleep(5000)
  }

  const { data: jobs } = await admin
    .from('video_jobs')
    .select('*')
    .in('id', jobIds)
    .order('created_at', { ascending: true })

  return (jobs ?? []) as Array<Record<string, unknown>>
}

async function waitForScheduledExecution(scheduleId: string, triggerType: 'manual' | 'recurrence', timeoutMs: number) {
  const admin = getSupabaseAdmin()
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const { data, error } = await admin
      .from('scheduled_content_run_executions')
      .select('*')
      .eq('scheduled_content_run_id', scheduleId)
      .eq('trigger_type', triggerType)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (data) {
      return data as Record<string, unknown>
    }

    await sleep(5000)
  }

  return null
}

async function loadUsageEvents(jobIds: string[]) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('usage_events')
    .select('id, event_name, units, unit_type, video_job_id, created_at')
    .in('video_job_id', jobIds)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  return data ?? []
}

async function loadAssetsForJobs(jobIds: string[]) {
  const admin = getSupabaseAdmin()
  const { data: jobs, error: jobsError } = await admin
    .from('video_jobs')
    .select('id, campaign_id, scheduled_content_run_execution_id, source_generation_job_id')
    .in('id', jobIds)

  if (jobsError) {
    throw jobsError
  }

  const generationJobIds = (jobs ?? [])
    .map((job) => job.source_generation_job_id)
    .filter((value): value is string => typeof value === 'string')

  if (generationJobIds.length === 0) {
    return []
  }

  const { data: assets, error: assetsError } = await admin
    .from('generated_assets')
    .select('id, generation_job_id, kind, storage_url, created_at')
    .in('generation_job_id', generationJobIds)
    .order('created_at', { ascending: false })

  if (assetsError) {
    throw assetsError
  }

  return (assets ?? []).map((asset) => {
    const job = (jobs ?? []).find((item) => item.source_generation_job_id === asset.generation_job_id)
    return {
      ...asset,
      video_job_id: job?.id ?? null,
      campaign_id: job?.campaign_id ?? null,
      scheduled_content_run_execution_id: job?.scheduled_content_run_execution_id ?? null,
    }
  })
}

async function forceScheduleDue(scheduleId: string, orgId: string) {
  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('scheduled_content_runs')
    .update({
      status: 'scheduled',
      next_run_at: isoNowOffset(-1),
      last_error_message: null,
    })
    .eq('id', scheduleId)
    .eq('org_id', orgId)

  if (error) {
    throw error
  }
}

async function loadScheduleSummary(session: AppSession, scheduleId: string) {
  const detail = await getScheduledContentRun(session, scheduleId)
  return {
    id: detail.schedule.id,
    status: detail.schedule.status,
    nextRunAt: detail.schedule.next_run_at,
    lastRunAt: detail.schedule.last_run_at,
    lastSuccessAt: detail.schedule.last_success_at,
    lastFailureAt: detail.schedule.last_failure_at,
    lastErrorMessage: detail.schedule.last_error_message,
    executions: detail.executions.map((execution) => ({
      id: execution.id,
      triggerType: execution.trigger_type,
      status: execution.status,
      jobsCreated: execution.jobs_created,
      errorMessage: execution.error_message,
      scheduledFor: execution.scheduled_for,
      completedAt: execution.completed_at,
      failedAt: execution.failed_at,
    })),
    jobs: detail.jobs,
  }
}

async function main() {
  console.log('Resolving org and analytics baseline...')
  const before = await getGenerationUsageMetrics({
    userId: TEST_USER_ID,
    orgId: await ensureOrgForUser(TEST_USER_ID),
    email: null,
    name: null,
  })

  const fixture = await buildFixtureContext()
  console.log('Built fixture context', fixture)

  const imageSchedule = await createSchedule(fixture, {
    title: `Smoke Image Schedule ${Date.now()}`,
    brief: 'Editorial portrait of an AI creator in a premium glass office, cinematic lighting, vertical composition.',
    jobKind: 'image',
    campaignId: fixture.imageCampaignId,
    workflowTemplateId: fixture.imageWorkflowTemplateId,
    influencerId: fixture.influencerId,
  })

  const videoSchedule = await createSchedule(fixture, {
    title: `Smoke Video Schedule ${Date.now()}`,
    brief: 'Vertical teaser for an AI creator SaaS launch with kinetic camera movement and premium lighting.',
    jobKind: 'video',
    campaignId: fixture.videoCampaignId,
    workflowTemplateId: fixture.videoWorkflowTemplateId,
    influencerId: fixture.influencerId,
    script: 'Hook the viewer in three beats: studio, workflow, result.',
  })

  const failureSchedule = await createSchedule(fixture, {
    title: `Smoke Failure Schedule ${Date.now()}`,
    brief: 'This schedule should fail because required generation metadata is missing.',
    jobKind: 'image',
    campaignId: fixture.imageCampaignId,
    workflowTemplateId: fixture.imageWorkflowTemplateId,
    influencerId: fixture.influencerId,
  })

  const dueSchedule = await createSchedule(fixture, {
    title: `Smoke Due Schedule ${Date.now()}`,
    brief: 'Naturally due image generation from the scheduler interval.',
    jobKind: 'image',
    campaignId: fixture.imageCampaignId,
    workflowTemplateId: fixture.imageWorkflowTemplateId,
    influencerId: fixture.influencerId,
  })

  const admin = getSupabaseAdmin()
  const { error: failurePatchError } = await admin
    .from('scheduled_content_runs')
    .update({
      influencer_id: null,
    })
    .eq('id', failureSchedule.id)
    .eq('org_id', fixture.session.orgId)

  if (failurePatchError) {
    throw failurePatchError
  }

  console.log('Triggering manual run-now schedules...')
  const imageRun = await runScheduledContentRunNow(fixture.session, imageSchedule.id)
  const videoRun = await runScheduledContentRunNow(fixture.session, videoSchedule.id)
  const failureRun = await runScheduledContentRunNow(fixture.session, failureSchedule.id)

  console.log('Forcing one due schedule...')
  await forceScheduleDue(dueSchedule.id, fixture.session.orgId)
  const dueExecution = await waitForScheduledExecution(dueSchedule.id, 'recurrence', 95_000)
  console.log('Observed due execution', dueExecution?.id ?? null)

  const allJobIds = [
    ...imageRun.createdJobIds,
    ...videoRun.createdJobIds,
    ...failureRun.createdJobIds,
  ]

  if (dueExecution) {
    const { data: dueJobs } = await admin
      .from('video_jobs')
      .select('id')
      .eq('scheduled_content_run_execution_id', String(dueExecution.id))
    allJobIds.push(...(dueJobs ?? []).map((job) => String(job.id)))
  }

  console.log('Waiting for jobs', allJobIds)
  const jobs = await waitForJobs(allJobIds, 5 * 60_000)
  const assets = await loadAssetsForJobs(allJobIds)
  const usageEvents = await loadUsageEvents(allJobIds)
  const scheduleDetails = await Promise.all([
    loadScheduleSummary(fixture.session, imageSchedule.id),
    loadScheduleSummary(fixture.session, videoSchedule.id),
    loadScheduleSummary(fixture.session, failureSchedule.id),
    loadScheduleSummary(fixture.session, dueSchedule.id),
  ])
  const assetPageData = await getAssets(fixture.session)
  const after = await getGenerationUsageMetrics(fixture.session)

  const summary = {
    fixture,
    runs: {
      imageRun,
      videoRun,
      failureRun,
      dueExecution,
    },
    schedules: scheduleDetails,
    jobs: jobs.map((job) => ({
      id: job.id,
      jobKind: job.job_kind,
      status: job.status,
      progress: job.progress,
      sourceGenerationJobId: job.source_generation_job_id,
      scheduledContentRunId: job.scheduled_content_run_id,
      scheduledContentRunExecutionId: job.scheduled_content_run_execution_id,
      retryCount: job.retry_count,
      failureStage: job.failure_stage,
      failureCode: job.failure_code,
      errorMessage: job.error_message,
    })),
    assets,
    assetPageCount: assetPageData.length,
    usageEvents,
    analytics: {
      before: before.metrics.totals,
      after: after.metrics.totals,
      usageEvents: after.metrics.usageEvents.slice(0, 10),
      byKind: after.metrics.byKind,
    },
  }

  console.log(JSON.stringify(summary, null, 2))
  process.exit(0)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
