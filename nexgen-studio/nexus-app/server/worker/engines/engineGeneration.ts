import { processGeneration } from '../processors/processGeneration'
import { reserveBlueprintCredits } from '../../../src/lib/blueprint/credits'

type ManagedGenerationInput = {
  admin: any
  userId: string
  organizationId: string
  influencerId: string
  prompt: string
  source: string
}

let cachedWorkflowTemplate: { id: string; cost: number } | null = null

async function resolveWorkflowTemplate(admin: any) {
  if (cachedWorkflowTemplate) {
    return cachedWorkflowTemplate
  }

  const { data: preferred } = await admin
    .from('workflow_templates')
    .select('id, base_cost_credits')
    .eq('slug', 'sfw-txt2img-v1')
    .eq('is_active', true)
    .maybeSingle()

  if (preferred?.id) {
    cachedWorkflowTemplate = {
      id: preferred.id,
      cost: Number(preferred.base_cost_credits || 0),
    }
    return cachedWorkflowTemplate
  }

  const { data: fallback } = await admin
    .from('workflow_templates')
    .select('id, base_cost_credits')
    .eq('type', 'IMAGE')
    .eq('content_policy', 'SFW')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!fallback?.id) {
    throw new Error('No active IMAGE workflow template found')
  }

  cachedWorkflowTemplate = {
    id: fallback.id,
    cost: Number(fallback.base_cost_credits || 0),
  }
  return cachedWorkflowTemplate
}

export async function runManagedImageGeneration(input: ManagedGenerationInput) {
  const workflowTemplate = await resolveWorkflowTemplate(input.admin)
  const { data: job, error } = await input.admin
    .from('generation_jobs')
    .insert({
      user_id: input.userId,
      organization_id: input.organizationId,
      influencer_id: input.influencerId,
      workflow_template_id: workflowTemplate.id,
      mode: 'IMAGE',
      content_policy: 'SFW',
      status: 'QUEUED',
      inputs_json: {
        prompt: input.prompt,
      },
      policy_decision_json: {
        source: input.source,
        allowed: true,
      },
    })
    .select('id')
    .single()

  if (error || !job?.id) {
    throw new Error(error?.message || 'Failed to create generation job')
  }

  try {
    await reserveBlueprintCredits(
      input.userId,
      workflowTemplate.cost,
      'GenerationJob',
      String(job.id)
    )
  } catch (error) {
    await input.admin
      .from('generation_jobs')
      .update({
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Failed to reserve credits',
      })
      .eq('id', job.id)
    throw error
  }

  await processGeneration(job.id)

  const { data: asset } = await input.admin
    .from('generated_assets')
    .select('id')
    .eq('generation_job_id', job.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return {
    jobId: job.id as string,
    assetId: asset?.id ? String(asset.id) : null,
  }
}
