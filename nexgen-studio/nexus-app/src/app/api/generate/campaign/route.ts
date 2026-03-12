/**
 * Multi-modal campaign generation: image + caption + hashtags in one call.
 * Deducts IMAGE_GENERATION + a flat caption cost from the user's credit balance.
 */

import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { getBlueprintSupabaseAdmin } from '@/lib/blueprint/supabaseAdmin'
import { canGenerate } from '@/lib/blueprint/entitlements'
import { reserveBlueprintCredits, releaseBlueprintCredits } from '@/lib/blueprint/credits'
import { TOKEN_COST_MATRIX, resolveGenerationRunTokenCost } from '@/lib/billing/tokenCosts'
import { generate, type ComfyUIWorkflow } from '@/lib/comfyui'
import { buildWorkflow, defaultVariables } from '@/lib/workflow/builder'
import type { VariableMap } from '@/lib/workflow/types'
import { uploadOutputs } from '@/lib/comfyui/storage'
import { chat } from '@/lib/llm'

export const maxDuration = 600

const CAPTION_TOKEN_COST = 2

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
    const platform =
      typeof body.platform === 'string' ? body.platform : 'instagram'
    const captionContext =
      typeof body.captionContext === 'string' ? body.captionContext : ''
    const contentRating =
      body.content_rating === 'nsfw' ? ('nsfw' as const) : ('sfw' as const)
    const variables =
      body.variables && typeof body.variables === 'object'
        ? (body.variables as Record<string, string | number | boolean>)
        : {}

    if (!influencerId) {
      return NextResponse.json(
        { detail: 'influencerId is required' },
        { status: 400 }
      )
    }
    if (!workflowTemplateId) {
      return NextResponse.json(
        { detail: 'workflowTemplateId is required' },
        { status: 400 }
      )
    }

    const admin = getBlueprintSupabaseAdmin()

    const [{ data: influencer }, { data: template }] = await Promise.all([
      admin
        .from('influencers')
        .select('id, org_id, name, niche, lore')
        .eq('id', influencerId)
        .maybeSingle(),
      admin
        .from('workflow_templates')
        .select(
          'id, slug, type, content_policy, is_active, base_cost_credits, comfy_workflow_json'
        )
        .eq('id', workflowTemplateId)
        .maybeSingle(),
    ])

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

    if (!template || !template.is_active) {
      return NextResponse.json({ detail: 'Workflow template not found' }, { status: 404 })
    }
    if (!canGenerate(profile, template)) {
      return NextResponse.json(
        { detail: 'Not entitled to this workflow' },
        { status: 403 }
      )
    }

    const rawWorkflow = template.comfy_workflow_json as ComfyUIWorkflow | null
    if (!rawWorkflow || typeof rawWorkflow !== 'object') {
      return NextResponse.json(
        { detail: 'Workflow template has no comfy_workflow_json' },
        { status: 400 }
      )
    }

    const imageCost = resolveGenerationRunTokenCost({
      type: (template.type === 'VIDEO' ? 'VIDEO' : 'IMAGE') as 'IMAGE' | 'VIDEO',
      templateBaseCostCredits: Number(template.base_cost_credits ?? 0),
    })
    const totalCost = imageCost + CAPTION_TOKEN_COST
    const runRefId = `campaign-${authUserId}-${Date.now()}`
    await reserveBlueprintCredits(authUserId, totalCost, 'CampaignGeneration', runRefId)
    reservedCredits.runRefId = runRefId
    reservedCredits.cost = totalCost

    const mergedVariables: VariableMap = {
      ...defaultVariables({ batch_size: 1 }),
      ...variables,
    }
    const workflow = buildWorkflow(rawWorkflow, { variables: mergedVariables })

    const promptText = typeof variables.prompt === 'string' ? variables.prompt : ''
    const captionPrompt = [
      `You are a social media content strategist.`,
      `Write a compelling ${platform} caption and 5-10 relevant hashtags for a post.`,
      influencer.name ? `Creator: ${influencer.name}` : '',
      influencer.niche ? `Niche: ${influencer.niche}` : '',
      promptText ? `Image prompt: ${promptText}` : '',
      captionContext ? `Additional context: ${captionContext}` : '',
      '',
      `Return ONLY valid JSON in this exact format:`,
      `{"caption": "your caption here", "hashtags": ["#tag1", "#tag2"]}`,
    ]
      .filter(Boolean)
      .join('\n')

    const [imageResult, captionReply] = await Promise.all([
      generate(workflow, {
        timeoutMs: template.type === 'VIDEO' ? 600_000 : 120_000,
        contentRating,
      }),
      chat(
        [{ role: 'user', content: captionPrompt }],
        'You generate social media captions and hashtags. Always respond with valid JSON only.',
        { model: process.env.OPENAI_GENERAL_MODEL || 'gpt-4o-mini', maxTokens: 512, temperature: 0.7 }
      ),
    ])

    if (imageResult.assets.length === 0) {
      return NextResponse.json(
        { detail: 'Generation produced no outputs' },
        { status: 502 }
      )
    }

    const pathPrefix = `${influencer.org_id}/${influencerId}/${imageResult.jobId}`.replace(
      /\/+/g,
      '/'
    )
    const toUpload = imageResult.assets.map(({ filename, buffer, kind }) => ({
      filename,
      buffer,
      kind,
    }))
    const uploadResults = await uploadOutputs(pathPrefix, toUpload, {
      isVault: contentRating === 'nsfw',
    })

    let caption = ''
    let hashtags: string[] = []
    try {
      const parsed = JSON.parse(captionReply)
      caption = typeof parsed.caption === 'string' ? parsed.caption : ''
      hashtags = Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : []
    } catch {
      caption = captionReply
    }

    return NextResponse.json({
      jobId: imageResult.jobId,
      backend: imageResult.backend,
      platform,
      caption,
      hashtags,
      outputs: uploadResults.map((r) => ({
        storagePath: r.storagePath,
        signedUrl: r.signedUrl,
        filename: r.filename,
        kind: r.kind,
      })),
      tokenCost: totalCost,
    })
  } catch (error) {
    if (authUserId && reservedCredits.runRefId && reservedCredits.cost > 0) {
      try {
        await releaseBlueprintCredits(
          authUserId,
          reservedCredits.cost,
          'CampaignGeneration',
          reservedCredits.runRefId
        )
      } catch { /* ignore */ }
    }
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Campaign generation failed' },
      { status }
    )
  }
}
