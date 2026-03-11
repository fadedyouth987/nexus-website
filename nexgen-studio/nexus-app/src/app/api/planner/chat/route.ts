import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { chat } from '@/lib/llm/client'
import {
  createPlan,
  saveBrief,
  generateStrategy,
  generateCalendar,
  regenerateContentRange,
  recordAiAction,
} from '@/lib/planner/actions'
import { MASTER_ASSISTANT_SYSTEM } from '@/lib/planner/prompts'
import type { PlanBriefInput } from '@/lib/planner/types'

const PLANS = 'planner_plans'
const PLAN_BRIEFS = 'planner_plan_briefs'
const STRATEGY_PROFILES = 'planner_strategy_profiles'
const CONTENT_ITEMS = 'planner_content_items'
const CHAT_THREADS = 'planner_chat_threads'
const CHAT_MESSAGES = 'planner_chat_messages'

const MAX_MESSAGES_CONTEXT = 20

export const maxDuration = 60

type ChatHistoryRow = {
  role: string | null
  message_text: string | null
}

function extractJsonBlock(text: string): Record<string, unknown> | null {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (!match) return null
  try {
    return JSON.parse(match[1].trim()) as Record<string, unknown>
  } catch {
    return null
  }
}

function stripJsonBlock(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```/g, '').trim()
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    let body: { threadId?: string; planId?: string; message?: string } = {}
    try {
      const parsed = await request.json()
      body =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? (parsed as typeof body)
          : {}
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 })
    }
    const messageText = typeof body.message === 'string' ? body.message.trim() : ''
    if (!messageText) {
      return NextResponse.json({ detail: 'message is required' }, { status: 400 })
    }

    const admin = getEngineSupabaseAdmin()
    let threadId = typeof body.threadId === 'string' ? body.threadId.trim() : null
    let planId = typeof body.planId === 'string' ? body.planId.trim() : null

    if (!threadId) {
      const newPlan = await createPlan(authUserId)
      planId = newPlan.planId
      const { data: newThread, error: threadError } = await admin
        .from(CHAT_THREADS)
        .insert({
          user_id: authUserId,
          plan_id: planId,
          current_stage: 'brief_intake',
        })
        .select('id')
        .single()
      if (threadError || !newThread?.id) {
        return NextResponse.json({ detail: 'Failed to create thread' }, { status: 500 })
      }
      threadId = newThread.id
    } else {
      const { data: thread } = await admin
        .from(CHAT_THREADS)
        .select('id, plan_id')
        .eq('id', threadId)
        .eq('user_id', authUserId)
        .maybeSingle()
      if (!thread) {
        return NextResponse.json({ detail: 'Thread not found' }, { status: 404 })
      }
      if (thread.plan_id) planId = thread.plan_id
    }

    await admin.from(CHAT_MESSAGES).insert({
      thread_id: threadId,
      role: 'user',
      message_text: messageText,
    })

    const { data: history } = await admin
      .from(CHAT_MESSAGES)
      .select('role, message_text')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(MAX_MESSAGES_CONTEXT)

    const messages = (history ?? []).map((m: ChatHistoryRow) => ({
      role:
        m.role === 'assistant' || m.role === 'system'
          ? m.role
          : 'user',
      content: m.message_text || '',
    }))

    const replyRaw = await chat(messages, MASTER_ASSISTANT_SYSTEM, {
      maxTokens: 2048,
      temperature: 0.6,
    })

    const jsonBlock = extractJsonBlock(replyRaw)
    let replyText = stripJsonBlock(replyRaw)
    let planSummary: Record<string, unknown> | null = null
    let contentItems: unknown[] = []
    let strategy: Record<string, unknown> | null = null

    if (jsonBlock && typeof jsonBlock.action === 'string' && planId) {
      try {
        if (jsonBlock.action === 'save_brief' && jsonBlock.brief && typeof jsonBlock.brief === 'object') {
          const b = jsonBlock.brief as Record<string, unknown>
          const brief: PlanBriefInput = {
            niche: typeof b.niche === 'string' ? b.niche : undefined,
            tone: typeof b.tone === 'string' ? b.tone : undefined,
            audience_json: Array.isArray(b.audience) ? b.audience as string[] : undefined,
            platforms_json: Array.isArray(b.platforms) ? b.platforms as string[] : undefined,
            posting_frequency_json: typeof b.posting_frequency_per_day === 'number' ? { per_day: b.posting_frequency_per_day } : undefined,
            monetization_goal: typeof b.monetization_goal === 'string' ? b.monetization_goal : undefined,
            visual_style: typeof b.visual_style === 'string' ? b.visual_style : undefined,
            constraints_json: b.constraints && typeof b.constraints === 'object' ? b.constraints as Record<string, unknown> : undefined,
          }
          await saveBrief(planId, brief)
          recordAiAction({ threadId, planId, actionType: 'save_brief', payload: { brief }, result: { ok: true } })
          await admin.from(CHAT_THREADS).update({ current_stage: 'strategy_synthesis' }).eq('id', threadId)

          const strat = await generateStrategy(planId)
          recordAiAction({ threadId, planId, actionType: 'generate_strategy', payload: {}, result: strat })
          await admin.from(CHAT_THREADS).update({ current_stage: 'calendar_generation' }).eq('id', threadId)

          const items = await generateCalendar(planId, 30)
          recordAiAction({ threadId, planId, actionType: 'generate_calendar', payload: { durationDays: 30 }, result: { count: items.length } })
          await admin.from(CHAT_THREADS).update({ current_stage: 'calendar_review' }).eq('id', threadId)

          contentItems = items
          const { data: planRow } = await admin.from(PLANS).select('*').eq('id', planId).single()
          const { data: briefRow } = await admin.from(PLAN_BRIEFS).select('*').eq('plan_id', planId).maybeSingle()
          const { data: strategyRow } = await admin.from(STRATEGY_PROFILES).select('*').eq('plan_id', planId).maybeSingle()
          planSummary = planRow ? { ...planRow, brief: briefRow, strategy: strategyRow } : null
          strategy = strategyRow ? (strategyRow as Record<string, unknown>) : null
        } else if (jsonBlock.action === 'generate_strategy' && planId) {
          const strat = await generateStrategy(planId)
          recordAiAction({ threadId, planId, actionType: 'generate_strategy', payload: {}, result: strat })
          await admin.from(CHAT_THREADS).update({ current_stage: 'calendar_generation' }).eq('id', threadId)
          strategy = strat
          const { data: strategyRow } = await admin.from(STRATEGY_PROFILES).select('*').eq('plan_id', planId).maybeSingle()
          if (strategyRow) strategy = strategyRow as Record<string, unknown>
        } else if (jsonBlock.action === 'generate_calendar' && planId) {
          const items = await generateCalendar(planId, 30)
          recordAiAction({ threadId, planId, actionType: 'generate_calendar', payload: {}, result: { count: items.length } })
          await admin.from(CHAT_THREADS).update({ current_stage: 'calendar_review' }).eq('id', threadId)
          contentItems = items
          const { data: planRow } = await admin.from(PLANS).select('*').eq('id', planId).single()
          planSummary = planRow ? (planRow as Record<string, unknown>) : null
        } else if (
          jsonBlock.action === 'regenerate_range' &&
          planId &&
          typeof jsonBlock.fromDay === 'number' &&
          typeof jsonBlock.toDay === 'number' &&
          typeof jsonBlock.instruction === 'string'
        ) {
          const { updated, changeSummary } = await regenerateContentRange(
            planId,
            jsonBlock.fromDay,
            jsonBlock.toDay,
            jsonBlock.instruction
          )
          recordAiAction({
            threadId,
            planId,
            actionType: 'regenerate_range',
            payload: { fromDay: jsonBlock.fromDay, toDay: jsonBlock.toDay, instruction: jsonBlock.instruction },
            result: { updated: updated.length, changeSummary },
          })
          const { data: items } = await admin.from(CONTENT_ITEMS).select('*').eq('plan_id', planId).order('day_number')
          contentItems = items ?? []
        }
      } catch (actionErr) {
        replyText += `\n\n(Note: I had trouble saving that to your plan: ${actionErr instanceof Error ? actionErr.message : 'Unknown error'}. You can try again or edit the plan manually.)`
      }
    }

    await admin.from(CHAT_MESSAGES).insert({
      thread_id: threadId,
      role: 'assistant',
      message_text: replyText,
      structured_output_json: jsonBlock,
    })

    if (!planSummary && planId) {
      const { data: planRow } = await admin.from(PLANS).select('*').eq('id', planId).single()
      const { data: briefRow } = await admin.from(PLAN_BRIEFS).select('*').eq('plan_id', planId).maybeSingle()
      const { data: strategyRow } = await admin.from(STRATEGY_PROFILES).select('*').eq('plan_id', planId).maybeSingle()
      planSummary = planRow ? { ...planRow, brief: briefRow, strategy: strategyRow } : null
      if (contentItems.length === 0) {
        const { data: items } = await admin.from(CONTENT_ITEMS).select('*').eq('plan_id', planId).order('day_number')
        contentItems = items ?? []
      }
      if (!strategy && strategyRow) strategy = strategyRow as Record<string, unknown>
    }

    return NextResponse.json({
      reply: replyText,
      threadId,
      planId,
      planSummary: planSummary ?? undefined,
      contentItems: contentItems.length > 0 ? contentItems : undefined,
      strategy: strategy ?? undefined,
    })
  } catch (err: unknown) {
    const status = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 500
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : 'Planner chat failed' },
      { status }
    )
  }
}
