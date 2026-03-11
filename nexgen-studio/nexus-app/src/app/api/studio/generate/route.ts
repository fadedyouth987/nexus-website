import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { createClient } from '@/lib/supabase/server'
import { getBlueprintReadModel } from '@/lib/blueprint/readModel'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { createBlueprintGenerationJob, getWorkflowTemplateIdBySlug } from '@/lib/blueprint/createJob'
import { writeActivityLog } from '@/lib/server/activityLog'
import {
  generationOutputLimitByPlan,
  normalizePlan,
  resolveRequestedOutputCount,
} from '@/lib/billing/planLimits'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export async function queueStudioJob(request: Request, mode: string) {
  if (getBlueprintReadModel() === 'exec') {
    try {
      const { authUserId, profile } = await requireBlueprintUser(request)
      let body: Record<string, unknown>
      try {
        body = await request.json()
      } catch {
        return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
      }

      const influencerId = typeof body.influencer_id === 'string' ? body.influencer_id : ''
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
      if (!influencerId || !prompt) {
        return NextResponse.json(
          { detail: 'influencer_id and prompt are required' },
          { status: 400 }
        )
      }

      const workflowByMode: Record<string, { slug: string; workflowMode: 'IMAGE' | 'VIDEO' }> = {
        txt2img: { slug: 'sfw-txt2img-v1', workflowMode: 'IMAGE' },
        img2img: { slug: 'sfw-img2img-v1', workflowMode: 'IMAGE' },
        controlnet: { slug: 'sfw-controlnet-v1', workflowMode: 'IMAGE' },
        upscale: { slug: 'sfw-upscale-v1', workflowMode: 'IMAGE' },
        video: { slug: 'sfw-video-v1', workflowMode: 'VIDEO' },
      }

      const routeConfig = workflowByMode[mode]
      const workflowTemplateId = routeConfig
        ? await getWorkflowTemplateIdBySlug(routeConfig.slug)
        : null

      if (!workflowTemplateId || !routeConfig) {
        return NextResponse.json({ detail: 'Workflow not found' }, { status: 404 })
      }

      const job = await createBlueprintGenerationJob({
        userId: authUserId,
        profile,
        influencerId,
        workflowTemplateId,
        mode: routeConfig.workflowMode,
        legacyMode: mode,
        inputs: {
          ...body,
          prompt,
        },
      })

      return NextResponse.json(
        {
          id: job.id,
          status: 'PENDING',
          error_message: null,
        },
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
          detail: error instanceof Error ? error.message : 'Failed to queue job',
          code: typedError.code,
          plan: typedError.plan,
          batchLimit: typedError.batchLimit,
        },
        { status }
      )
    }
  }

  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })
  const userId = typeof token?.id === 'string' ? token.id : null

  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
  }

  const influencerId =
    typeof body.influencer_id === 'string' ? body.influencer_id : ''
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''

  if (!influencerId || !prompt) {
    return NextResponse.json(
      { detail: 'influencer_id and prompt are required' },
      { status: 400 }
    )
  }

  const admin = getEngineSupabaseAdmin()
  const { data: profile } = await admin
    .from('blueprint_users')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()
  const plan = normalizePlan(profile?.plan)
  const batchLimit = generationOutputLimitByPlan(plan)
  const requestedOutputs = resolveRequestedOutputCount(body)
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

  const supabase = await createClient()
  const { data: influencer } = await supabase
    .from('influencers')
    .select('id, org_id')
    .eq('id', influencerId)
    .maybeSingle()

  if (!influencer) {
    return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', influencer.org_id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('generations')
    .insert({
      user_id: userId,
      creator_id: influencerId,
      prompt,
      negative_prompt:
        typeof body.negative_prompt === 'string' ? body.negative_prompt : '',
      model:
        typeof body.checkpoint === 'string' && body.checkpoint
          ? body.checkpoint
          : 'sd15',
      status: 'queued',
      parameters: {
        ...body,
        mode,
      },
    })
    .select('id, status, error_message')
    .single()

  if (error) {
    return NextResponse.json({ detail: 'Failed to queue job' }, { status: 500 })
  }

  const { data: creatorV2 } = await supabase
    .from('creators_v2')
    .select('workspace_id')
    .eq('org_id', influencer.org_id)
    .eq('legacy_creator_id', influencerId)
    .maybeSingle()

  await writeActivityLog({
    supabase,
    orgId: influencer.org_id,
    workspaceId: creatorV2?.workspace_id || null,
    actorId: userId,
    action: 'legacy.generation.queued',
    entityType: 'generation',
    entityId: data.id,
    metadata: {
      creator_id: influencerId,
      mode,
      prompt,
      source: 'api.studio.generate.legacy',
    },
  })

  return NextResponse.json({
    id: data.id,
    status: 'PENDING',
    error_message: data.error_message || null,
  }, { status: 201 })
}

export async function POST(request: Request) {
  return queueStudioJob(request, 'txt2img')
}
