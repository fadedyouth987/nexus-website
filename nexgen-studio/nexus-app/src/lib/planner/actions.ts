/**
 * Planner action engine: createPlan, saveBrief, generateStrategy, generateCalendar, regenerateContentRange.
 * All DB writes go through this layer. Uses Supabase admin client.
 */

import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { chat } from '@/lib/llm/client'
import type { PlanBriefInput, ContentItemInput } from './types'
import {
  getBriefExtractionPrompt,
  getStrategySynthesisPrompt,
  getCalendarGenerationPrompt,
  getRevisionPrompt,
  parseJsonFromResponse,
} from './prompts'

const PLANS = 'planner_plans'
const PLAN_VERSIONS = 'planner_plan_versions'
const PLAN_BRIEFS = 'planner_plan_briefs'
const STRATEGY_PROFILES = 'planner_strategy_profiles'
const CONTENT_ITEMS = 'planner_content_items'
const AI_ACTIONS = 'planner_ai_actions'

function dateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function createPlan(
  userId: string,
  options: { name?: string; timezone?: string } = {}
): Promise<{ planId: string }> {
  const admin = getEngineSupabaseAdmin()
  const { data, error } = await admin
    .from(PLANS)
    .insert({
      user_id: userId,
      name: options.name || 'Untitled plan',
      timezone: options.timezone || 'UTC',
    })
    .select('id')
    .single()
  if (error || !data?.id) {
    throw new Error(error?.message || 'Failed to create plan')
  }
  return { planId: String(data.id) }
}

export async function saveBrief(planId: string, brief: PlanBriefInput): Promise<void> {
  const admin = getEngineSupabaseAdmin()
  const row = {
    plan_id: planId,
    niche: brief.niche ?? null,
    tone: brief.tone ?? null,
    audience_json: Array.isArray(brief.audience_json) ? brief.audience_json : [],
    platforms_json: Array.isArray(brief.platforms_json) ? brief.platforms_json : [],
    posting_frequency_json: brief.posting_frequency_json && typeof brief.posting_frequency_json === 'object' ? brief.posting_frequency_json : {},
    monetization_goal: brief.monetization_goal ?? null,
    visual_style: brief.visual_style ?? null,
    constraints_json: brief.constraints_json && typeof brief.constraints_json === 'object' ? brief.constraints_json : {},
  }
  const { error } = await admin.from(PLAN_BRIEFS).upsert(row, { onConflict: 'plan_id' })
  if (error) throw new Error(error.message)
}

export async function generateStrategy(planId: string): Promise<Record<string, unknown>> {
  const admin = getEngineSupabaseAdmin()
  const { data: briefRow } = await admin.from(PLAN_BRIEFS).select('*').eq('plan_id', planId).maybeSingle()
  if (!briefRow) {
    throw new Error('Plan has no brief. Save a brief first.')
  }
  const briefJson = JSON.stringify({
    niche: briefRow.niche,
    tone: briefRow.tone,
    audience: briefRow.audience_json,
    platforms: briefRow.platforms_json,
    monetization_goal: briefRow.monetization_goal,
    visual_style: briefRow.visual_style,
    constraints: briefRow.constraints_json,
  })
  const prompt = getStrategySynthesisPrompt(briefJson)
  const raw = await chat([{ role: 'user', content: prompt }], 'You output only valid JSON.', {
    maxTokens: 1024,
    temperature: 0.4,
  })
  let parsed: Record<string, unknown>
  try {
    parsed = parseJsonFromResponse(raw) as Record<string, unknown>
  } catch {
    throw new Error('Failed to parse strategy JSON from LLM')
  }
  const contentPillars = Array.isArray(parsed.content_pillars) ? parsed.content_pillars : []
  const funnelStages = Array.isArray(parsed.funnel_stages) ? parsed.funnel_stages : []
  const weeklyRhythm = parsed.weekly_rhythm && typeof parsed.weekly_rhythm === 'object' ? parsed.weekly_rhythm : {}
  const ctaRules = parsed.cta_rules && typeof parsed.cta_rules === 'object' ? parsed.cta_rules : {}
  const brandRules = parsed.brand_rules && typeof parsed.brand_rules === 'object' ? parsed.brand_rules : {}

  await admin.from(STRATEGY_PROFILES).upsert(
    {
      plan_id: planId,
      content_pillars_json: contentPillars,
      funnel_stages_json: funnelStages,
      weekly_rhythm_json: weeklyRhythm,
      cta_rules_json: ctaRules,
      brand_rules_json: brandRules,
    },
    { onConflict: 'plan_id' }
  )
  return parsed
}

export async function generateCalendar(planId: string, durationDays: number = 30): Promise<ContentItemInput[]> {
  const admin = getEngineSupabaseAdmin()
  const [briefRes, strategyRes] = await Promise.all([
    admin.from(PLAN_BRIEFS).select('*').eq('plan_id', planId).maybeSingle(),
    admin.from(STRATEGY_PROFILES).select('*').eq('plan_id', planId).maybeSingle(),
  ])
  if (!briefRes.data) throw new Error('Plan has no brief.')
  if (!strategyRes.data) throw new Error('Plan has no strategy. Generate strategy first.')
  const briefJson = JSON.stringify(briefRes.data)
  const strategyJson = JSON.stringify(strategyRes.data)

  const startDate = new Date()
  startDate.setDate(startDate.getDate() + 1)

  const prompt = getCalendarGenerationPrompt(briefJson, strategyJson, durationDays)
  const raw = await chat([{ role: 'user', content: prompt }], 'You output only a valid JSON array.', {
    maxTokens: 4096,
    temperature: 0.5,
  })
  let items: ContentItemInput[]
  try {
    const arr = parseJsonFromResponse(raw) as Record<string, unknown>[]
    if (!Array.isArray(arr)) throw new Error('Expected array')
    items = arr.map((o) => ({
      day_number: Number(o.day_number) || 0,
      publish_date: typeof o.publish_date === 'string' ? o.publish_date : undefined,
      platform: typeof o.platform === 'string' ? o.platform : 'instagram',
      slot_number: Number(o.slot_number) || 1,
      content_pillar: typeof o.content_pillar === 'string' ? o.content_pillar : undefined,
      funnel_stage: typeof o.funnel_stage === 'string' ? o.funnel_stage : undefined,
      post_type: typeof o.post_type === 'string' ? o.post_type : undefined,
      title: typeof o.title === 'string' ? o.title : undefined,
      hook: typeof o.hook === 'string' ? o.hook : undefined,
      angle: typeof o.angle === 'string' ? o.angle : undefined,
      caption_direction: typeof o.caption_direction === 'string' ? o.caption_direction : undefined,
      cta: typeof o.cta === 'string' ? o.cta : undefined,
      prompt_seed: typeof o.prompt_seed === 'string' ? o.prompt_seed : undefined,
      status: (o.status as 'draft' | 'approved' | 'scheduled') || 'draft',
    }))
  } catch (e) {
    throw new Error('Failed to parse calendar JSON from LLM: ' + (e instanceof Error ? e.message : String(e)))
  }

  const { data: version } = await admin
    .from(PLAN_VERSIONS)
    .insert({
      plan_id: planId,
      version_number: 1,
      change_summary: 'Initial 30-day calendar generated',
      created_by: 'ai',
    })
    .select('id')
    .single()

  await admin.from(CONTENT_ITEMS).delete().eq('plan_id', planId)

  const versionId = version?.id ?? null
  for (const it of items) {
    if (!it.day_number || it.day_number < 1 || it.day_number > durationDays) continue
    const d = new Date(startDate)
    d.setDate(d.getDate() + (it.day_number - 1))
    await admin.from(CONTENT_ITEMS).insert({
      plan_id: planId,
      plan_version_id: versionId,
      day_number: it.day_number,
      publish_date: it.publish_date || dateOnly(d),
      platform: it.platform || 'instagram',
      slot_number: it.slot_number ?? 1,
      content_pillar: it.content_pillar ?? null,
      funnel_stage: it.funnel_stage ?? null,
      post_type: it.post_type ?? null,
      title: it.title ?? null,
      hook: it.hook ?? null,
      angle: it.angle ?? null,
      caption_direction: it.caption_direction ?? null,
      cta: it.cta ?? null,
      prompt_seed: it.prompt_seed ?? null,
      status: it.status || 'draft',
    })
  }

  return items
}

export async function regenerateContentRange(
  planId: string,
  fromDay: number,
  toDay: number,
  instruction: string
): Promise<{ updated: ContentItemInput[]; changeSummary: string }> {
  const admin = getEngineSupabaseAdmin()
  const [briefRes, strategyRes, itemsRes] = await Promise.all([
    admin.from(PLAN_BRIEFS).select('*').eq('plan_id', planId).maybeSingle(),
    admin.from(STRATEGY_PROFILES).select('*').eq('plan_id', planId).maybeSingle(),
    admin.from(CONTENT_ITEMS).select('*').eq('plan_id', planId).gte('day_number', fromDay).lte('day_number', toDay).order('day_number'),
  ])
  if (!briefRes.data || !strategyRes.data) throw new Error('Plan missing brief or strategy.')
  const items = (itemsRes.data ?? []) as Record<string, unknown>[]
  const itemsJson = JSON.stringify(items, null, 2)

  const prompt = getRevisionPrompt(instruction, itemsJson, fromDay, toDay)
  const raw = await chat([{ role: 'user', content: prompt }], 'You output only a valid JSON array.', {
    maxTokens: 4096,
    temperature: 0.5,
  })
  let revised: ContentItemInput[]
  try {
    const arr = parseJsonFromResponse(raw) as Record<string, unknown>[]
    if (!Array.isArray(arr)) throw new Error('Expected array')
    revised = arr.map((o) => ({
      day_number: Number(o.day_number) || 0,
      publish_date: typeof o.publish_date === 'string' ? o.publish_date : undefined,
      platform: typeof o.platform === 'string' ? o.platform : 'instagram',
      slot_number: Number(o.slot_number) || 1,
      content_pillar: typeof o.content_pillar === 'string' ? o.content_pillar : undefined,
      funnel_stage: typeof o.funnel_stage === 'string' ? o.funnel_stage : undefined,
      post_type: typeof o.post_type === 'string' ? o.post_type : undefined,
      title: typeof o.title === 'string' ? o.title : undefined,
      hook: typeof o.hook === 'string' ? o.hook : undefined,
      angle: typeof o.angle === 'string' ? o.angle : undefined,
      caption_direction: typeof o.caption_direction === 'string' ? o.caption_direction : undefined,
      cta: typeof o.cta === 'string' ? o.cta : undefined,
      prompt_seed: typeof o.prompt_seed === 'string' ? o.prompt_seed : undefined,
      status: (o.status as 'draft' | 'approved' | 'scheduled') || 'draft',
    }))
  } catch (e) {
    throw new Error('Failed to parse revision JSON: ' + (e instanceof Error ? e.message : String(e)))
  }

  const { data: maxVersion } = await admin
    .from(PLAN_VERSIONS)
    .select('version_number')
    .eq('plan_id', planId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()
  const nextNum = ((maxVersion as { version_number: number } | null)?.version_number ?? 0) + 1

  const { data: version } = await admin
    .from(PLAN_VERSIONS)
    .insert({
      plan_id: planId,
      version_number: nextNum,
      change_summary: `Regenerated days ${fromDay}-${toDay}: ${instruction.slice(0, 100)}`,
      created_by: 'ai',
    })
    .select('id')
    .single()

  const versionId = version?.id ?? null
  for (const it of revised) {
    if (!it.day_number || it.day_number < fromDay || it.day_number > toDay) continue
    await admin
      .from(CONTENT_ITEMS)
      .update({
        plan_version_id: versionId,
        platform: it.platform || 'instagram',
        slot_number: it.slot_number ?? 1,
        content_pillar: it.content_pillar ?? null,
        funnel_stage: it.funnel_stage ?? null,
        post_type: it.post_type ?? null,
        title: it.title ?? null,
        hook: it.hook ?? null,
        angle: it.angle ?? null,
        caption_direction: it.caption_direction ?? null,
        cta: it.cta ?? null,
        prompt_seed: it.prompt_seed ?? null,
        status: it.status || 'draft',
      })
      .eq('plan_id', planId)
      .eq('day_number', it.day_number)
  }

  return {
    updated: revised,
    changeSummary: `Regenerated days ${fromDay}-${toDay}: ${instruction.slice(0, 80)}`,
  }
}

export function recordAiAction(params?: {
  threadId: string | null
  planId: string | null
  actionType: string
  payload: Record<string, unknown>
  result: Record<string, unknown>
  status?: string
}): void {
  if (!params) {
    return
  }

  const admin = getEngineSupabaseAdmin()
  void admin.from(AI_ACTIONS).insert({
    thread_id: params.threadId,
    plan_id: params.planId,
    action_type: params.actionType,
    payload_json: params.payload,
    result_json: params.result,
    status: params.status ?? 'ok',
  })
}
