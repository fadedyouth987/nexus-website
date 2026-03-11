/**
 * LLM Router: classify a message as persona (in-character) vs general (platform help).
 * Frontend can use this for automatic routing or use explicit routing.
 */

import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { routeMessage } from '@/lib/llm'
import type { RouterLLMResponse } from '@/lib/llm/types'

export const maxDuration = 10

export async function POST(request: Request) {
  try {
    await requireBlueprintUser(request)

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) {
      return NextResponse.json({ detail: 'message is required' }, { status: 400 })
    }

    const route = await routeMessage(message)
    const result: RouterLLMResponse = { route }
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Router failed'
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    return NextResponse.json({ detail: msg }, { status })
  }
}
