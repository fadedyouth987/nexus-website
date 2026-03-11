/**
 * Legacy /ai/generate-image endpoint: delegates to blueprint generation job.
 * Accepts GenerationPanel payload (positive, negative, steps, cfg, etc.) and
 * maps to createBlueprintGenerationJob inputs. Uses default influencer when
 * influencer_id is not provided.
 */
import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { createBlueprintGenerationJob, getWorkflowTemplateIdBySlug } from '@/lib/blueprint/createJob'
import { getBlueprintReadModel } from '@/lib/blueprint/readModel'
import { getBlueprintSupabaseAdmin } from '@/lib/blueprint/supabaseAdmin'

type GenerateImageBody = {
  positive?: string
  negative?: string
  steps?: number
  cfg?: number
  seed?: number
  sampler_name?: string
  scheduler?: string
  denoise?: number
  width?: number
  height?: number
  batch_size?: number
  model?: string
  vae?: string
  loras?: Array<{ name: string; path: string; strength: number }>
  controlnet?: { model: string; preprocessor: string; strength: number } | null
  influencer_id?: string
}

async function getDefaultInfluencerId(userId: string): Promise<string | null> {
  const admin = getBlueprintSupabaseAdmin()
  const { data: member } = await admin
    .from('organization_members')
    .select('org_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (!member?.org_id) return null
  const { data: influencer } = await admin
    .from('influencers')
    .select('id')
    .eq('org_id', member.org_id)
    .limit(1)
    .maybeSingle()
  return influencer?.id ?? null
}

export async function POST(request: Request) {
  if (getBlueprintReadModel() !== 'exec') {
    return NextResponse.json(
      { detail: 'Blueprint exec mode required for /api/ai/generate-image' },
      { status: 501 }
    )
  }

  try {
    const { authUserId, profile } = await requireBlueprintUser(request)
    let body: GenerateImageBody
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const prompt = typeof body.positive === 'string' ? body.positive.trim() : 'masterpiece, best quality'
    const negativePrompt = typeof body.negative === 'string' ? body.negative.trim() : ''

    let influencerId = typeof body.influencer_id === 'string' ? body.influencer_id.trim() : null
    if (!influencerId) {
      influencerId = await getDefaultInfluencerId(authUserId)
    }
    if (!influencerId) {
      return NextResponse.json(
        { detail: 'No influencer found. Create an influencer or pass influencer_id.' },
        { status: 400 }
      )
    }

    const workflowTemplateId = await getWorkflowTemplateIdBySlug('sfw-txt2img-v1')
    if (!workflowTemplateId) {
      return NextResponse.json({ detail: 'Workflow not found' }, { status: 404 })
    }

    const job = await createBlueprintGenerationJob({
      userId: authUserId,
      profile,
      influencerId,
      workflowTemplateId,
      mode: 'IMAGE',
      legacyMode: 'txt2img',
      inputs: {
        prompt,
        negative_prompt: negativePrompt,
        steps: body.steps,
        cfg: body.cfg,
        seed: body.seed,
        sampler_name: body.sampler_name,
        scheduler: body.scheduler,
        denoise: body.denoise,
        width: body.width,
        height: body.height,
        batch_size: body.batch_size,
        model: body.model,
        vae: body.vae,
        loras: body.loras,
        controlnet: body.controlnet,
      },
    })

    return NextResponse.json(
      { jobId: job.id, id: job.id, status: 'PENDING' },
      { status: 201 }
    )
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500
    const typedError = error as {
      code?: string
      plan?: string
      batchLimit?: number
    }
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : 'Generation failed',
        code: typedError.code,
        plan: typedError.plan,
        batchLimit: typedError.batchLimit,
      },
      { status }
    )
  }
}
