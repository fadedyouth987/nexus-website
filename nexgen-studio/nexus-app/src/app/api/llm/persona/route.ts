/**
 * Persona LLM: in-character replies for comments, DMs, engagement, captions.
 * Uses influencer personality, lore, and voice. Never breaks character.
 */

import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { getBlueprintSupabaseAdmin } from '@/lib/blueprint/supabaseAdmin'
import {
  buildPersonaSystemPrompt,
  chat,
  type LLMMessage,
  type PersonaContext,
} from '@/lib/llm'

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireBlueprintUser(request)

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const influencerId = typeof body.influencerId === 'string' ? body.influencerId : ''
    const rawMessages = Array.isArray(body.messages) ? body.messages : []
    const messages: LLMMessage[] = rawMessages
      .filter((m: unknown) => m && typeof m === 'object' && 'role' in m && 'content' in m)
      .map((m: any) => ({ role: m.role, content: String(m.content) }))
      .filter((m) => ['system', 'user', 'assistant'].includes(m.role))

    if (!influencerId) {
      return NextResponse.json({ detail: 'influencerId is required' }, { status: 400 })
    }
    if (messages.length === 0) {
      return NextResponse.json({ detail: 'messages array is required' }, { status: 400 })
    }

    const admin = getBlueprintSupabaseAdmin()

    const { data: influencer } = await admin
      .from('influencers')
      .select(
        'id, org_id, name, personality_system_prompt, personality_json, lore_memory, voice_style'
      )
      .eq('id', influencerId)
      .maybeSingle()

    if (!influencer) {
      return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
    }

    const { data: member } = await admin
      .from('organization_members')
      .select('id')
      .eq('org_id', influencer.org_id)
      .eq('user_id', authUserId)
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
    }

    const context: PersonaContext = {
      influencerId: influencer.id,
      influencerName: (influencer.name as string) || 'Character',
      personality:
        typeof influencer.personality_json === 'object' && influencer.personality_json != null
          ? (influencer.personality_json as Record<string, unknown>)
          : {},
      loreMemory:
        typeof influencer.lore_memory === 'object' && influencer.lore_memory != null
          ? (influencer.lore_memory as Record<string, unknown>)
          : {},
      voiceStyle:
        typeof influencer.voice_style === 'string' ? influencer.voice_style : null,
      personalitySystemPrompt:
        typeof influencer.personality_system_prompt === 'string'
          ? influencer.personality_system_prompt
          : null,
    }

    const ctx = body.context as Record<string, unknown> | undefined
    if (ctx?.recentPosts && Array.isArray(ctx.recentPosts)) {
      context.recentPosts = ctx.recentPosts.map(String).slice(-5)
    }
    if (ctx?.recentMessages && Array.isArray(ctx.recentMessages)) {
      context.recentMessages = (ctx.recentMessages as LLMMessage[]).slice(-20)
    }
    if (typeof ctx?.contextHint === 'string') {
      context.contextHint = ctx.contextHint.trim()
    }

    const systemPrompt = buildPersonaSystemPrompt(context)

    const model = process.env.OPENAI_PERSONA_MODEL || 'gpt-4o'
    const reply = await chat(messages, systemPrompt, {
      model,
      maxTokens: 512,
      temperature: 0.85,
    })

    return NextResponse.json({ reply, role: 'assistant' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Persona LLM failed'
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    return NextResponse.json({ detail: msg }, { status })
  }
}
