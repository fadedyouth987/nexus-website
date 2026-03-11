import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { createClient } from '@/lib/supabase/server'
import { getBlueprintReadModel, listJobs } from '@/lib/blueprint/readModel'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { createBlueprintGenerationJob, getWorkflowTemplateIdBySlug } from '@/lib/blueprint/createJob'
import { writeActivityLog } from '@/lib/server/activityLog'

type GenerationInsert = {
  user_id: string
  creator_id: string
  prompt: string
  negative_prompt: string
  model: string
  status: string
  parameters: Record<string, unknown>
}

function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this'
}

async function getUserId(request: Request) {
  const token = await getToken({ req: request as any, secret: getAuthSecret() })
  return typeof token?.id === 'string' ? token.id : null
}

export async function GET(request: Request) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  let data
  try {
    data = await listJobs({ supabase, userId })
  } catch {
    return NextResponse.json({ detail: 'Failed to load generations' }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  if (getBlueprintReadModel() === 'exec') {
    try {
      const { authUserId, profile } = await requireBlueprintUser(request)
      let body: Partial<GenerationInsert>
      try {
        body = await request.json()
      } catch {
        return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
      }

      const creatorId = body.creator_id?.trim()
      const prompt = body.prompt?.trim()
      if (!creatorId || !prompt) {
        return NextResponse.json(
          { detail: 'creator_id and prompt are required' },
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
        influencerId: creatorId,
        workflowTemplateId,
        mode: 'IMAGE',
        legacyMode: 'txt2img',
        inputs: {
          prompt,
          negative_prompt: body.negative_prompt?.trim() ?? '',
          checkpoint: body.model?.trim() || 'stable-diffusion',
          ...(body.parameters && typeof body.parameters === 'object' ? body.parameters : {}),
        },
      })

      return NextResponse.json(
        {
          id: job.id,
          creator_id: job.influencer_id,
          user_id: job.user_id,
          prompt,
          negative_prompt: body.negative_prompt?.trim() ?? '',
          model: body.model?.trim() || 'stable-diffusion',
          status: 'queued',
          error_message: null,
          parameters: job.inputs_json,
          created_at: job.created_at,
          updated_at: job.updated_at,
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
          detail: error instanceof Error ? error.message : 'Failed to create generation request',
          code: typedError.code,
          plan: typedError.plan,
          batchLimit: typedError.batchLimit,
        },
        { status }
      )
    }
  }

  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  let body: Partial<GenerationInsert>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
  }

  const creatorId = body.creator_id?.trim()
  const prompt = body.prompt?.trim()

  if (!creatorId || !prompt) {
    return NextResponse.json(
      { detail: 'creator_id and prompt are required' },
      { status: 400 }
    )
  }

  const supabase = await createClient()
  const { data: creator } = await supabase
    .from('creators')
    .select('id')
    .eq('id', creatorId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!creator) {
    return NextResponse.json({ detail: 'Creator not found' }, { status: 404 })
  }

  const payload: GenerationInsert = {
    user_id: userId,
    creator_id: creatorId,
    prompt,
    negative_prompt: body.negative_prompt?.trim() ?? '',
    model: body.model?.trim() || 'stable-diffusion',
    status: 'queued',
    parameters:
      body.parameters && typeof body.parameters === 'object' ? body.parameters : {},
  }

  const { data, error } = await supabase
    .from('generations')
    .insert(payload)
    .select(
      'id, creator_id, user_id, prompt, negative_prompt, model, status, error_message, parameters, created_at, updated_at'
    )
    .single()

  if (error) {
    return NextResponse.json({ detail: 'Failed to create generation request' }, { status: 500 })
  }

  const [{ data: orgMembership }, { data: creatorV2 }] = await Promise.all([
    supabase
      .from('org_members_v2')
      .select('org_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('creators_v2')
      .select('org_id, workspace_id')
      .eq('legacy_creator_id', creatorId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const orgId = creatorV2?.org_id || orgMembership?.org_id || null
  if (orgId) {
    await writeActivityLog({
      supabase,
      orgId,
      workspaceId: creatorV2?.workspace_id || null,
      actorId: userId,
      action: 'legacy.generation.queued',
      entityType: 'generation',
      entityId: data.id,
      metadata: {
        creator_id: creatorId,
        model: payload.model,
        source: 'api.generations.legacy',
      },
    })
  }

  return NextResponse.json(data, { status: 201 })
}
