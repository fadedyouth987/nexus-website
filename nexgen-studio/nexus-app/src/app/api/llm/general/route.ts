/**
 * General LLM: platform help, how-to, support. Factual, neutral, no roleplay.
 */

import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import {
  buildGeneralSystemPrompt,
  chat,
  type LLMMessage,
} from '@/lib/llm'

export const maxDuration = 30

export async function POST(request: Request) {
  try {
    await requireBlueprintUser(request)

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const rawMessages = Array.isArray(body.messages) ? body.messages : []
    const messages: LLMMessage[] = rawMessages
      .filter((m: unknown) => m && typeof m === 'object' && 'role' in m && 'content' in m)
      .map((m: any) => ({ role: m.role, content: String(m.content) }))
      .filter((m) => ['system', 'user', 'assistant'].includes(m.role))

    if (messages.length === 0) {
      return NextResponse.json({ detail: 'messages array is required' }, { status: 400 })
    }

    const scope = typeof body.scope === 'string' ? body.scope : undefined
    const systemPrompt = buildGeneralSystemPrompt(scope)

    const model = process.env.OPENAI_GENERAL_MODEL || 'gpt-4o-mini'
    const reply = await chat(messages, systemPrompt, {
      model,
      maxTokens: 1024,
      temperature: 0.3,
    })

    return NextResponse.json({ reply, role: 'assistant' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'General LLM failed'
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    return NextResponse.json({ detail: msg }, { status })
  }
}
