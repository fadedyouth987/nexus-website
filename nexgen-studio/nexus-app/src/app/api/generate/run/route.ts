/**
 * Sync ComfyUI generation: load template from Supabase, inject variables,
 * submit to ComfyUI Headless, wait for completion, upload to Supabase Storage, return signed URLs.
 */

import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { getBlueprintSupabaseAdmin } from '@/lib/blueprint/supabaseAdmin'
import { canGenerate } from '@/lib/blueprint/entitlements'
import { reserveBlueprintCredits, releaseBlueprintCredits } from '@/lib/blueprint/credits'
import { resolveGenerationRunTokenCost } from '@/lib/billing/tokenCosts'
import { generate, type ComfyUIWorkflow } from '@/lib/comfyui'
import { buildWorkflow, defaultVariables } from '@/lib/workflow/builder'
import type { VariableMap } from '@/lib/workflow/types'
import { uploadOutputs } from '@/lib/comfyui/storage'
import type { KnownModelId } from '@/lib/comfyui/models'
import {
  generationOutputLimitByPlan,
  normalizePlan,
  resolveRequestedOutputCount,
} from '@/lib/billing/planLimits'

export const maxDuration = 600 // 10 min for video

export async function POST(request: Request) {
  const reservedCredits = { runRefId: null as string | null, cost: 0 }
  let authUserId: string | undefined
  try {
    const user = await requireBlueprintUser(request)
    authUserId = user.authUserId
    const { profile } = user

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const influencerId =
      typeof body.influencerId === 'string' ? body.influencerId : ''
    const workflowTemplateId =
      typeof body.workflowTemplateId === 'string' ? body.workflowTemplateId : ''
    const contentRating =
      body.content_rating === 'nsfw' ? 'nsfw' as const : 'sfw' as const
    const workflowJson = body.workflowJson as ComfyUIWorkflow | null | undefined
    const variables =
      body.variables && typeof body.variables === 'object'
        ? (body.variables as Record<string, string | number | boolean>)
        : {}
    const modelOverrides =
      body.modelOverrides && typeof body.modelOverrides === 'object'
        ? (body.modelOverrides as Record<string, string>)
        : {}
    const isCustomWorkflow = workflowJson && typeof workflowJson === 'object'

    if (!influencerId) {
      return NextResponse.json(
        { detail: 'influencerId is required' },
        { status: 400 }
      )
    }
    if (!isCustomWorkflow && !workflowTemplateId) {
      return NextResponse.json(
        { detail: 'workflowTemplateId or workflowJson is required' },
        { status: 400 }
      )
    }

    const plan = normalizePlan(profile.plan)
    const batchLimit = generationOutputLimitByPlan(plan)
    const requestedOutputs = resolveRequestedOutputCount(variables)
    if (requestedOutputs > batchLimit) {
      return NextResponse.json(
        {
          detail: `Your ${plan} plan supports up to ${batchLimit} outputs per generation request.`,
          code: 'BATCH_LIMIT_EXCEEDED',
          plan,
          batchLimit,
        },
        { status: 403 }
      )
    }

    const admin = getBlueprintSupabaseAdmin()

    const { data: influencer } = await admin
      .from('influencers')
      .select('id, org_id')
      .eq('id', influencerId)
      .maybeSingle()

    if (!influencer) {
      return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
    }

    const { data: member } = await admin
      .from('organization_members')
      .select('id')
      .eq('user_id', authUserId)
      .eq('org_id', influencer.org_id)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
    }

    let rawWorkflow: ComfyUIWorkflow
    let runType: 'IMAGE' | 'VIDEO'
    let inferredModel: KnownModelId
    let templateBaseCostCredits: number | null = null

    if (isCustomWorkflow) {
      rawWorkflow = workflowJson as ComfyUIWorkflow
      runType = (body.type === 'VIDEO' ? 'VIDEO' : 'IMAGE') as 'IMAGE' | 'VIDEO'
      inferredModel = (typeof body.model === 'string' ? body.model : 'sd15') as KnownModelId
    } else {
      const { data: template } = await admin
        .from('workflow_templates')
        .select(
          'id, slug, type, content_policy, is_active, base_cost_credits, comfy_workflow_json, variables_json'
        )
        .eq('id', workflowTemplateId)
        .maybeSingle()

      if (!template || !template.is_active) {
        return NextResponse.json({ detail: 'Workflow not found' }, { status: 404 })
      }
      if (!canGenerate(profile, template)) {
        return NextResponse.json(
          { detail: 'Not entitled to this workflow' },
          { status: 403 }
        )
      }
      templateBaseCostCredits = Number(template.base_cost_credits ?? 0)
      const fromTemplate = template.comfy_workflow_json as ComfyUIWorkflow | null
      if (!fromTemplate || typeof fromTemplate !== 'object') {
        return NextResponse.json(
          { detail: 'Workflow template has no comfy_workflow_json' },
          { status: 400 }
        )
      }
      rawWorkflow = fromTemplate
      runType = template.type === 'VIDEO' ? 'VIDEO' : 'IMAGE'
      const slug = (template.slug || '') as string
      if (typeof body.model === 'string') {
        inferredModel = body.model as KnownModelId
      } else if (slug.includes('flux')) {
        inferredModel = 'flux'
      } else if (slug.includes('sdxl')) {
        inferredModel = 'sdxl'
      } else if (slug.includes('sd15') || slug.includes('sd1.5')) {
        inferredModel = 'sd15'
      } else if (slug.includes('sd1')) {
        inferredModel = 'sd1'
      } else {
        inferredModel = 'sdxl'
      }
    }

    const cost = resolveGenerationRunTokenCost({
      type: runType,
      templateBaseCostCredits,
    })
    const runRefId = `sync-run-${authUserId}-${Date.now()}`
    await reserveBlueprintCredits(authUserId, cost, 'GenerationRun', runRefId)
    reservedCredits.runRefId = runRefId
    reservedCredits.cost = cost

    const mergedVariables: VariableMap = {
      ...defaultVariables({ batch_size: 1 }),
      ...variables,
    }

    const workflow = buildWorkflow(rawWorkflow, {
      variables: mergedVariables,
      modelName: inferredModel,
      modelOverrides: Object.keys(modelOverrides).length ? modelOverrides : undefined,
    })

    const result = await generate(workflow, {
      timeoutMs: runType === 'VIDEO' ? 600_000 : 120_000,
      onProgress: (status) => console.log(`Generation status: ${status}`),
      contentRating,
    })

    if (result.assets.length === 0) {
      return NextResponse.json(
        { detail: 'Generation produced no outputs' },
        { status: 502 }
      )
    }

    const pathPrefix = `${influencer.org_id}/${influencerId}/${result.jobId}`.replace(
      /\/+/g,
      '/'
    )
    const toUpload = result.assets.map(({ filename, buffer, kind }) => ({
      filename,
      buffer,
      kind,
    }))
    const uploadResults = await uploadOutputs(pathPrefix, toUpload, {
      isVault: contentRating === 'nsfw',
    })

    return NextResponse.json({
      jobId: result.jobId,
      backend: result.backend,
      outputs: uploadResults.map((r) => ({
        storagePath: r.storagePath,
        signedUrl: r.signedUrl,
        filename: r.filename,
        kind: r.kind,
      })),
    })
  } catch (error) {
    if (authUserId && reservedCredits.runRefId && reservedCredits.cost > 0) {
      try {
        await releaseBlueprintCredits(authUserId, reservedCredits.cost, 'GenerationRun', reservedCredits.runRefId)
      } catch { /* ignore */ }
    }
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    const typedError = error as {
      code?: string
      plan?: string
      batchLimit?: number
    }
    return NextResponse.json(
      {
        detail:
          error instanceof Error ? error.message : 'Generation failed',
        code: typedError.code,
        plan: typedError.plan,
        batchLimit: typedError.batchLimit,
      },
      { status }
    )
  }
}
