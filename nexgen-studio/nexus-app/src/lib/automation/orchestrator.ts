import { createServiceClient } from '@/lib/supabase/service'
import { enqueueGenerationJob } from '@/lib/jobs/generationQueue'
import { triggerWebhooksForOrg, type WebhookEventType } from '@/lib/automation/webhookDelivery'
import { moderateAsset } from '@/lib/automation/moderation'
import { generateThumbnailForAsset } from '@/lib/automation/assetTransformation'

export type PipelineStepType = 
  | 'generation'
  | 'moderation'
  | 'transformation'
  | 'notification'
  | 'webhook'
  | 'storage'

export type PipelineStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface PipelineStep {
  name: string
  type: PipelineStepType
  config: Record<string, unknown>
  dependsOn?: string[]
}

export interface PipelineDefinition {
  name: string
  steps: PipelineStep[]
}

export async function createAutomationRun(
  orgId: string,
  userId: string | null,
  automationType: string,
  triggerType: 'manual' | 'scheduled' | 'webhook' | 'api',
  triggerSource: string | null,
  inputParams: Record<string, unknown>
): Promise<string> {
  const service = createServiceClient()

  const { data } = await service
    .from('automation_runs')
    .insert({
      org_id: orgId,
      user_id: userId,
      automation_type: automationType,
      trigger_type: triggerType,
      trigger_source: triggerSource,
      input_params: inputParams,
      status: 'running',
    })
    .select('id')
    .single()

  if (!data) {
    throw new Error('Failed to create automation run')
  }

  return data.id
}

export async function createPipelineSteps(
  runId: string,
  orgId: string,
  steps: PipelineStep[]
): Promise<void> {
  const service = createServiceClient()

  const stepsToInsert = steps.map((step, index) => ({
    run_id: runId,
    org_id: orgId,
    step_name: step.name,
    step_type: step.type,
    status: 'pending' as const,
    input_params: step.config,
    step_order: index,
  }))

  await service
    .from('automation_run_steps')
    .insert(stepsToInsert)
}

export async function executePipeline(
  runId: string,
  orgId: string,
  userId: string | null,
  steps: PipelineStep[]
): Promise<{ success: boolean; error?: string }> {
  const service = createServiceClient()
  const startedAt = Date.now()

  try {
    // Create steps in DB
    await createPipelineSteps(runId, orgId, steps)

    // Execute steps in order
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]
      
      // Check dependencies
      if (step.dependsOn?.length) {
        const { data: dependencySteps } = await service
          .from('automation_run_steps')
          .select('status')
          .eq('run_id', runId)
          .in('step_name', step.dependsOn)

        const allDepsCompleted = dependencySteps?.every(d => d.status === 'completed')
        if (!allDepsCompleted) {
          await updateStepStatus(runId, step.name, 'skipped', { errorMessage: 'Dependencies not met' })
          continue
        }
      }

      // Execute step
      await updateStepStatus(runId, step.name, 'running')
      const stepStartedAt = Date.now()

      try {
        const result = await executeStep(step, runId, orgId, userId)
        const stepDuration = Date.now() - stepStartedAt

        await updateStepStatus(runId, step.name, 'completed', {
          outputResult: result,
          durationMs: stepDuration,
        })
      } catch (error: any) {
        const stepDuration = Date.now() - stepStartedAt

        await updateStepStatus(runId, step.name, 'failed', {
          errorMessage: error.message ?? 'Step execution failed',
          durationMs: stepDuration,
        })

        // Mark run as failed
        await service
          .from('automation_runs')
          .update({
            status: 'failed',
            error_message: error.message ?? 'Pipeline step failed',
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - startedAt,
          })
          .eq('id', runId)

        return { success: false, error: error.message }
      }
    }

    // Mark run as completed
    await service
      .from('automation_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
      })
      .eq('id', runId)

    return { success: true }
  } catch (error: any) {
    await service
      .from('automation_runs')
      .update({
        status: 'failed',
        error_message: error.message ?? 'Pipeline execution failed',
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
      })
      .eq('id', runId)

    return { success: false, error: error.message }
  }
}

async function executeStep(
  step: PipelineStep,
  runId: string,
  orgId: string,
  userId: string | null
): Promise<Record<string, unknown>> {
  switch (step.type) {
    case 'generation':
      return await executeGenerationStep(step, orgId, userId)
    
    case 'moderation':
      return await executeModerationStep(step, orgId)
    
    case 'transformation':
      return await executeTransformationStep(step, orgId)
    
    case 'webhook':
      return await executeWebhookStep(step, orgId)
    
    case 'notification':
      return await executeNotificationStep(step, orgId, userId)
    
    case 'storage':
      return await executeStorageStep(step, orgId)
    
    default:
      throw new Error(`Unknown step type: ${step.type}`)
  }
}

async function executeGenerationStep(
  step: PipelineStep,
  orgId: string,
  userId: string | null
): Promise<Record<string, unknown>> {
  const service = createServiceClient()
  const config = step.config as Record<string, unknown>

  const { data: job } = await service
    .from('generation_jobs')
    .insert({
      org_id: orgId,
      user_id: userId,
      job_type: config.job_type ?? 'image',
      input_params: config.input_params ?? {},
      status: 'queued',
    })
    .select('id')
    .single()

  if (!job?.id) {
    throw new Error('Failed to create generation job')
  }

  await enqueueGenerationJob(job.id, {
    planSlug: (config.plan_slug as string) ?? undefined,
    priority: (config.priority as number) ?? undefined,
  })

  return { jobId: job.id, status: 'enqueued' }
}

async function executeModerationStep(
  step: PipelineStep,
  orgId: string
): Promise<Record<string, unknown>> {
  const config = step.config as Record<string, unknown>
  const assetId = config.asset_id as string
  const jobId = config.job_id as string

  if (!assetId) {
    throw new Error('asset_id is required for moderation step')
  }

  const result = await moderateAsset(assetId, orgId, jobId, {
    provider: (config.provider as any) ?? undefined,
    apiKey: (config.api_key as string) ?? undefined,
  })

  return {
    assetId,
    status: result.status,
    safetyRating: result.safetyRating,
  }
}

async function executeTransformationStep(
  step: PipelineStep,
  orgId: string
): Promise<Record<string, unknown>> {
  const config = step.config as Record<string, unknown>
  const assetId = config.asset_id as string

  if (!assetId) {
    throw new Error('asset_id is required for transformation step')
  }

  const thumbnailUrl = await generateThumbnailForAsset(assetId, orgId)

  return {
    assetId,
    thumbnailUrl,
    status: thumbnailUrl ? 'completed' : 'failed',
  }
}

async function executeWebhookStep(
  step: PipelineStep,
  orgId: string
): Promise<Record<string, unknown>> {
  const config = step.config as Record<string, unknown>
  const eventType = (config.event_type as WebhookEventType) ?? 'job.completed'
  const data = (config.data as Record<string, unknown>) ?? {}

  await triggerWebhooksForOrg(orgId, eventType, data)

  return {
    eventType,
    status: 'triggered',
  }
}

async function executeNotificationStep(
  step: PipelineStep,
  orgId: string,
  userId: string | null
): Promise<Record<string, unknown>> {
  const config = step.config as Record<string, unknown>
  const message = config.message as string

  // In production, integrate with email/push notification service
  console.info(`[notification] org=${orgId} user=${userId}: ${message}`)

  return {
    status: 'sent',
    message,
  }
}

async function executeStorageStep(
  step: PipelineStep,
  orgId: string
): Promise<Record<string, unknown>> {
  const config = step.config as Record<string, unknown>
  const assetId = config.asset_id as string

  if (!assetId) {
    throw new Error('asset_id is required for storage step')
  }

  // In production, perform storage operations here
  return {
    assetId,
    status: 'completed',
  }
}

async function updateStepStatus(
  runId: string,
  stepName: string,
  status: PipelineStepStatus,
  options?: {
    outputResult?: Record<string, unknown>
    errorMessage?: string
    durationMs?: number
    jobId?: string
  }
): Promise<void> {
  const service = createServiceClient()

  const updateData: any = {
    status,
    ...(options?.outputResult ? { output_result: options.outputResult } : {}),
    ...(options?.errorMessage ? { error_message: options.errorMessage } : {}),
    ...(options?.durationMs ? { duration_ms: options.durationMs } : {}),
    ...(options?.jobId ? { job_id: options.jobId } : {}),
    ...(status === 'running' ? { started_at: new Date().toISOString() } : {}),
    ...(status === 'completed' || status === 'failed' ? { completed_at: new Date().toISOString() } : {}),
  }

  await service
    .from('automation_run_steps')
    .update(updateData)
    .eq('run_id', runId)
    .eq('step_name', stepName)
}

export async function getAutomationRun(runId: string): Promise<any> {
  const service = createServiceClient()

  const { data: run } = await service
    .from('automation_runs')
    .select(`
      *,
      steps:automation_run_steps (
        id,
        step_name,
        step_type,
        status,
        input_params,
        output_result,
        error_message,
        job_id,
        started_at,
        completed_at,
        duration_ms,
        step_order
      )
    `)
    .eq('id', runId)
    .single()

  return run
}

export async function getAutomationRunsForOrg(
  orgId: string,
  options?: { limit?: number; offset?: number; status?: string }
): Promise<any[]> {
  const service = createServiceClient()

  let query = service
    .from('automation_runs')
    .select('*')
    .eq('org_id', orgId)
    .order('started_at', { ascending: false })
    .range(options?.offset ?? 0, (options?.offset ?? 0) + (options?.limit ?? 50) - 1)

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  const { data } = await query
  return data ?? []
}
