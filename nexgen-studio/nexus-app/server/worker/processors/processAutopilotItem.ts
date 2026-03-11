import { getWorkerSupabaseAdmin } from '../core/supabaseAdmin'
import { runManagedImageGeneration } from '../engines/engineGeneration'

type AutopilotItemPayload = {
  kind: 'autopilot_item'
  planItemId: string
}

async function refreshAutopilotPlanStatus(admin: any, planId: string) {
  const { data: items } = await admin
    .from('autopilot_plan_items')
    .select('status')
    .eq('plan_id', planId)

  const rows = Array.isArray(items) ? items : []
  const total = rows.length
  const ready = rows.filter((row) => row.status === 'READY').length
  const failed = rows.filter((row) => row.status === 'FAILED').length

  let status = 'RUNNING'
  let completedAt: string | null = null
  if (total > 0 && ready === total) {
    status = 'COMPLETED'
    completedAt = new Date().toISOString()
  } else if (total > 0 && failed === total) {
    status = 'FAILED'
    completedAt = new Date().toISOString()
  }

  await admin
    .from('autopilot_plans')
    .update({
      status,
      completed_at: completedAt,
    })
    .eq('id', planId)
}

export async function processAutopilotItem(payload: AutopilotItemPayload) {
  const admin = getWorkerSupabaseAdmin()

  const { data: item } = await admin
    .from('autopilot_plan_items')
    .select(
      'id, plan_id, day_index, status, title, prompt, content_plan_id, generation_job_id, generated_asset_id'
    )
    .eq('id', payload.planItemId)
    .maybeSingle()

  if (!item) {
    throw new Error(`Autopilot item not found: ${payload.planItemId}`)
  }

  if (item.status === 'READY') {
    return { ok: true, skipped: true, reason: 'already_ready' }
  }

  const { data: plan } = await admin
    .from('autopilot_plans')
    .select('id, user_id, organization_id, influencer_id, niche, brand_style')
    .eq('id', item.plan_id)
    .maybeSingle()

  if (!plan) {
    throw new Error(`Autopilot plan not found for item ${item.id}`)
  }

  const prompt =
    (typeof item.prompt === 'string' && item.prompt.trim()) ||
    `Create day ${item.day_index} content in ${plan.niche} with ${plan.brand_style} style.`

  await admin
    .from('autopilot_plan_items')
    .update({
      status: 'GENERATING',
      error: null,
      progress_json: {
        status: 'running',
        message: 'Submitting generation job',
        updatedAt: new Date().toISOString(),
      },
    })
    .eq('id', item.id)

  try {
    const generation = await runManagedImageGeneration({
      admin,
      userId: plan.user_id,
      organizationId: plan.organization_id,
      influencerId: plan.influencer_id,
      prompt,
      source: 'worker.autopilot_item',
    })

    await admin
      .from('autopilot_plan_items')
      .update({
        status: 'READY',
        generation_job_id: generation.jobId,
        generated_asset_id: generation.assetId,
        progress_json: {
          status: 'ready',
          percent: 100,
          message: 'Complete',
          updatedAt: new Date().toISOString(),
        },
        error: null,
      })
      .eq('id', item.id)

    if (item.content_plan_id) {
      await admin
        .from('content_plans')
        .update({
          notes: `${prompt}\n\nGenerated asset: ${generation.assetId || 'n/a'}`,
        })
        .eq('id', item.content_plan_id)
    }

    await refreshAutopilotPlanStatus(admin, plan.id)
    return { ok: true, generationJobId: generation.jobId, assetId: generation.assetId }
  } catch (error) {
    await admin
      .from('autopilot_plan_items')
      .update({
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Autopilot generation failed',
        progress_json: {
          status: 'failed',
          message: error instanceof Error ? error.message : 'Autopilot generation failed',
          updatedAt: new Date().toISOString(),
        },
      })
      .eq('id', item.id)

    await refreshAutopilotPlanStatus(admin, plan.id)
    throw error
  }
}
