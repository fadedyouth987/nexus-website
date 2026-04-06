import { canGenerate, maxConcurrentJobs } from './entitlements'
import { enqueueBlueprintGeneration, queueName } from './queue'
import { reserveBlueprintCredits } from './credits'
import { writeBlueprintAudit } from './audit'
import { getBlueprintSupabaseAdmin } from './supabaseAdmin'
import { writeActivityLog } from '../server/activityLog'
import {
  generationOutputLimitByPlan,
  normalizePlan,
  resolveRequestedOutputCount,
} from '../billing/planLimits'
import { isMissingColumnError } from '@/server/supabase/errors'

type CreateJobInput = {
  userId: string
  profile: {
    plan: string
    plan_status: string
    age_verified_at: string | null
  }
  influencerId: string
  workflowTemplateId: string
  mode: 'IMAGE' | 'VIDEO'
  legacyMode?: string
  inputs: Record<string, unknown>
}

export async function createBlueprintGenerationJob(input: CreateJobInput) {
  const admin = getBlueprintSupabaseAdmin()

  const { data: influencer } = await admin
    .from('influencers')
    .select('id, org_id')
    .eq('id', input.influencerId)
    .maybeSingle()

  if (!influencer) {
    const error = new Error('Influencer not found')
    ;(error as Error & { status?: number }).status = 404
    throw error
  }

  const member = await resolveOrganizationMembership(admin, input.userId, influencer.org_id)

  if (!member) {
    const error = new Error('Influencer not found')
    ;(error as Error & { status?: number }).status = 404
    throw error
  }

  const { data: template } = await admin
    .from('workflow_templates')
    .select(
      'id, slug, type, content_policy, requires_vault, min_age, base_cost_credits, is_active'
    )
    .eq('id', input.workflowTemplateId)
    .maybeSingle()

  if (!template) {
    const error = new Error('Workflow not found')
    ;(error as Error & { status?: number }).status = 404
    throw error
  }

  if (!template.is_active) {
    const error = new Error('Workflow not found')
    ;(error as Error & { status?: number }).status = 404
    throw error
  }

  if (template.type !== input.mode) {
    const error = new Error('Mode mismatch')
    ;(error as Error & { status?: number }).status = 400
    throw error
  }

  if (!canGenerate(input.profile, template)) {
    const error = new Error('Not entitled to this workflow')
    ;(error as Error & { status?: number }).status = 403
    throw error
  }

  const plan = normalizePlan(input.profile.plan)
  const batchLimit = generationOutputLimitByPlan(plan)
  const requestedOutputs = resolveRequestedOutputCount(input.inputs)
  if (requestedOutputs > batchLimit) {
    const error = new Error(
      `Your ${plan} plan supports up to ${batchLimit} outputs per generation request.`
    )
    const typedError = error as Error & {
      status?: number
      code?: string
      plan?: string
      batchLimit?: number
    }
    typedError.status = 403
    typedError.code = 'BATCH_LIMIT_EXCEEDED'
    typedError.plan = plan
    typedError.batchLimit = batchLimit
    throw error
  }

  const { count } = await admin
    .from('generation_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .in('status', ['QUEUED', 'GENERATING'])

  if ((count || 0) >= maxConcurrentJobs(input.profile)) {
    const error = new Error('Concurrency limit reached')
    ;(error as Error & { status?: number }).status = 429
    throw error
  }

  const policyDecision = {
    plan: input.profile.plan,
    plan_status: input.profile.plan_status,
    age_verified_at: input.profile.age_verified_at,
    template_policy: template.content_policy,
    allowed: true,
  }

  const { data: job, error: insertError } = await admin
    .from('generation_jobs')
    .insert({
      user_id: input.userId,
      organization_id: influencer.org_id,
      influencer_id: influencer.id,
      workflow_template_id: template.id,
      mode: input.mode,
      legacy_mode: input.legacyMode || null,
      content_policy: template.content_policy,
      status: 'QUEUED',
      inputs_json: input.inputs,
      policy_decision_json: policyDecision,
    })
    .select('*')
    .single()

  if (insertError || !job) {
    throw new Error(insertError?.message || 'Failed to create generation job')
  }

  await reserveBlueprintCredits(
    input.userId,
    Number(template.base_cost_credits || 0),
    'GenerationJob',
    job.id
  )

  await enqueueBlueprintGeneration(job.id, queueName(template.content_policy, template.type))

  await writeBlueprintAudit(input.userId, 'GENERATION_ENQUEUE', 'GenerationJob', job.id, {
    workflowTemplateId: template.id,
    workflowSlug: template.slug,
  })

  await writeActivityLog({
    supabase: admin,
    orgId: influencer.org_id,
    actorId: input.userId,
    action: 'generation.queued',
    entityType: 'generation_job',
    entityId: job.id,
    metadata: {
      influencer_id: influencer.id,
      workflow_template_id: template.id,
      workflow_slug: template.slug,
      mode: input.mode,
      legacy_mode: input.legacyMode || null,
      content_policy: template.content_policy,
      source: 'blueprint.create_job',
    },
  })

  return job
}

async function resolveOrganizationMembership(
  admin: ReturnType<typeof getBlueprintSupabaseAdmin>,
  userId: string,
  orgId: string
) {
  const legacyOrgIdMember = await admin
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!legacyOrgIdMember.error) {
    if (legacyOrgIdMember.data) {
      return legacyOrgIdMember.data
    }
  } else if (!isMissingColumnError(legacyOrgIdMember.error)) {
    throw legacyOrgIdMember.error
  }

  const legacyOrganizationIdMember = await admin
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!legacyOrganizationIdMember.error) {
    if (legacyOrganizationIdMember.data) {
      return legacyOrganizationIdMember.data
    }
  } else if (!isMissingColumnError(legacyOrganizationIdMember.error)) {
    throw legacyOrganizationIdMember.error
  }

  const v2Member = await admin
    .from('org_members_v2')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (v2Member.error) {
    throw v2Member.error
  }

  return v2Member.data
}

export async function getWorkflowTemplateIdBySlug(slug: string) {
  const admin = getBlueprintSupabaseAdmin()
  const { data } = await admin
    .from('workflow_templates')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  return data?.id || null
}
