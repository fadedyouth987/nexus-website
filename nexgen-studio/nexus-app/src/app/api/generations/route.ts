import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { createBlueprintGenerationJob, getWorkflowTemplateIdBySlug } from '@/lib/blueprint/createJob'
import { listJobs } from '@/lib/blueprint/readModel'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/generations - List user's generation jobs
 * Returns blueprint generation_jobs (source of truth)
 */
export async function GET(request: Request) {
  const userId = request.headers.get('x-user-id')

  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()

  try {
    const data = await listJobs({ supabase, userId })
    return NextResponse.json(data ?? [])
  } catch {
    return NextResponse.json({ detail: 'Failed to load generations' }, { status: 500 })
  }
}

/**
 * POST /api/generations - Create new generation job
 * Creates via blueprint system (single code path)
 */
export async function POST(request: Request) {
  try {
    const { authUserId, profile } = await requireBlueprintUser(request)

    let body: { creator_id?: string; prompt?: string; negative_prompt?: string; model?: string; parameters?: Record<string, unknown> }
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
