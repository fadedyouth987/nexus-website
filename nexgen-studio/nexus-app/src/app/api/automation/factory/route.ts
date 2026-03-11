import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { createPlan, saveBrief, generateStrategy, generateCalendar } from '@/lib/planner/actions'
import { queuePlannerToScheduler } from '@/lib/automation/queuePlannerToScheduler'
import type { PlanBriefInput } from '@/lib/planner/types'

type FactoryPayload = {
  persona?: {
    name?: string
    niche?: string
    personality?: string
    speech_style?: string
    catchphrases?: string[]
    posting_frequency?: number
    monetization_strategy?: string
    audience_type?: string
    tone?: string
    platforms?: string[]
    content_rating?: 'sfw' | 'nsfw'
    model_source?: 'builtin' | 'custom'
    custom_model_source?: string
  }
}

function toArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : []
}

async function createCreatorForUser(
  userId: string,
  persona: NonNullable<FactoryPayload['persona']>
): Promise<{ id: string; mode: 'legacy' | 'v2' | 'none'; orgId?: string; workspaceId?: string }> {
  const admin = getEngineSupabaseAdmin()
  const name = (persona.name || '').trim()
  const niche = (persona.niche || '').trim()
  const handleBase = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const handle = (handleBase || `creator_${Date.now()}`).slice(0, 40)

  const legacyInsert = await admin
    .from('creators')
    .insert({
      user_id: userId,
      name,
      handle,
      niche,
      bio: persona.personality || '',
      style_template: persona.speech_style || 'default',
      vault_mode: persona.content_rating === 'nsfw' ? 'nsfw' : 'sfw',
      status: 'active',
    })
    .select('id')
    .single()

  if (!legacyInsert.error && legacyInsert.data?.id) {
    return { id: String(legacyInsert.data.id), mode: 'legacy' }
  }

  const { data: orgMember } = await admin
    .from('org_members_v2')
    .select('org_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!orgMember?.org_id) {
    return { id: '', mode: 'none' }
  }

  const { data: workspaceMember } = await admin
    .from('workspace_members_v2')
    .select('workspace_id')
    .eq('org_id', orgMember.org_id)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!workspaceMember?.workspace_id) {
    return { id: '', mode: 'none' }
  }

  const v2Insert = await admin
    .from('creators_v2')
    .insert({
      org_id: orgMember.org_id,
      workspace_id: workspaceMember.workspace_id,
      name,
      handle,
      niche,
      status: 'active',
      brand_profile: {
        personality: persona.personality || '',
        speech_style: persona.speech_style || '',
        catchphrases: toArray(persona.catchphrases),
        audience_type: persona.audience_type || '',
        tone: persona.tone || '',
      },
    })
    .select('id')
    .single()

  if (!v2Insert.error && v2Insert.data?.id) {
    return {
      id: String(v2Insert.data.id),
      mode: 'v2',
      orgId: String(orgMember.org_id),
      workspaceId: String(workspaceMember.workspace_id),
    }
  }

  return { id: '', mode: 'none' }
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    let body: FactoryPayload = {}
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const persona = body.persona || {}
    const name = String(persona.name || '').trim()
    const niche = String(persona.niche || '').trim()
    if (!name || !niche) {
      return NextResponse.json({ detail: 'persona.name and persona.niche are required' }, { status: 400 })
    }

    const creator = await createCreatorForUser(authUserId, persona)

    const { planId } = await createPlan(authUserId, { name: `${name} - 30-day plan` })

    const brief: PlanBriefInput = {
      niche,
      tone: String(persona.tone || persona.speech_style || 'confident').trim(),
      audience_json: toArray([persona.audience_type || 'general audience']),
      platforms_json: toArray(persona.platforms).length > 0 ? toArray(persona.platforms) : ['instagram', 'tiktok'],
      posting_frequency_json:
        typeof persona.posting_frequency === 'number' && Number.isFinite(persona.posting_frequency)
          ? { per_day: Math.max(1, Math.min(6, Math.floor(persona.posting_frequency))) }
          : { per_day: 1 },
      monetization_goal: String(persona.monetization_strategy || 'growth and conversion').trim(),
      visual_style: String(persona.speech_style || '').trim() || 'clean',
      constraints_json: {
        avoid: [],
        prefer: toArray(persona.catchphrases),
        content_rating: persona.content_rating === 'nsfw' ? 'nsfw' : 'sfw',
        model_source: persona.model_source === 'custom' ? 'custom' : 'builtin',
        custom_model_source: persona.custom_model_source ? String(persona.custom_model_source) : null,
        personality: String(persona.personality || '').trim(),
      },
    }

    await saveBrief(planId, brief)
    const strategy = await generateStrategy(planId)
    const items = await generateCalendar(planId, 30)
    let schedulerQueue: { queuedContent: number; queuedSchedules: number } | null = null
    if (creator.mode === 'v2' && creator.orgId && creator.workspaceId && creator.id) {
      schedulerQueue = await queuePlannerToScheduler({
        userId: authUserId,
        planId,
        orgId: creator.orgId,
        workspaceId: creator.workspaceId,
        creatorId: creator.id,
      })
    }

    const admin = getEngineSupabaseAdmin()
    let monetizationOfferId: string | null = null
    if (String(persona.monetization_strategy || '').trim()) {
      const offerInsert = await admin
        .from('monetization_offers')
        .insert({
          user_id: authUserId,
          name: `${name} starter offer`,
          offer_type: 'paid_shoutout',
          content_rating: persona.content_rating === 'nsfw' ? 'nsfw' : 'sfw',
          platform: toArray(persona.platforms)[0] || 'instagram',
          price_cents: 500,
          currency: 'usd',
          status: 'draft',
        })
        .select('id')
        .single()
      if (!offerInsert.error && offerInsert.data?.id) {
        monetizationOfferId = String(offerInsert.data.id)
      }
    }

    return NextResponse.json({
      ok: true,
      creator,
      planId,
      strategy,
      contentItemsCount: items.length,
      schedulerQueue,
      monetizationOfferId,
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Factory failed' },
      { status }
    )
  }
}

