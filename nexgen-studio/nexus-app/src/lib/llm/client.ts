/**
 * LLM chat client. Uses OpenAI-compatible API.
 * - Open Router: set OPENROUTER_API_KEY (and optionally OPENROUTER_BASE_URL, OPENROUTER_MODEL).
 * - OpenAI: set OPENAI_API_KEY and optionally OPENAI_BASE_URL, OPENAI_MODEL.
 * Open Router is used when OPENROUTER_API_KEY is set; otherwise OpenAI is used.
 */

import type { LLMMessage } from './types'

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions'
const OPENROUTER_BASE_DEFAULT = 'https://openrouter.ai/api/v1'

export interface ChatOptions {
  /** Override API key. */
  apiKey?: string
  /** Override base URL (e.g. for Azure or Open Router). */
  baseUrl?: string
  /** Model: persona = creative; general = accurate. */
  model?: string
  maxTokens?: number
  temperature?: number
}

function getConfig(): { apiKey: string; baseUrl: string; modelDefault: string; provider: 'openrouter' | 'openai' } {
  const openRouterKey = process.env.OPENROUTER_API_KEY
  if (openRouterKey) {
    return {
      apiKey: openRouterKey,
      baseUrl: (process.env.OPENROUTER_BASE_URL || OPENROUTER_BASE_DEFAULT).trim(),
      modelDefault: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
      provider: 'openrouter',
    }
  }
  const apiKey = process.env.OPENAI_API_KEY
  const baseUrl = (process.env.OPENAI_BASE_URL || OPENAI_CHAT_URL.replace('/v1/chat/completions', '')).trim()
  return {
    apiKey: apiKey || '',
    baseUrl,
    modelDefault: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    provider: 'openai',
  }
}

/**
 * Call chat completion. Returns assistant message content or throws.
 */
export async function chat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  systemPrompt: string,
  options: ChatOptions = {}
): Promise<string> {
  const config = getConfig()
  const apiKey = options.apiKey ?? config.apiKey
  if (!apiKey) {
    throw new Error('Set OPENROUTER_API_KEY or OPENAI_API_KEY for the Assistant LLM')
  }

  const baseUrl = (options.baseUrl ?? config.baseUrl).replace(/\/$/, '')
  const path = baseUrl.includes('/v1') ? '/chat/completions' : '/v1/chat/completions'
  const url = `${baseUrl}${path}`

  const model = options.model ?? config.modelDefault
  const payload = {
    model,
    messages: [
      { role: 'system' as const, content: systemPrompt },
      ...messages,
    ],
    max_tokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.7,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`LLM request failed (${res.status}): ${errBody.slice(0, 500)}`)
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
    error?: { message?: string }
  }
  if (data.error?.message) {
    throw new Error(data.error.message)
  }
  const content = data.choices?.[0]?.message?.content
  if (content == null) {
    throw new Error('LLM returned no content')
  }
  return content.trim()
}

/**
 * Classify a single user message for routing: persona vs general.
 * Uses a tiny prompt and fast model for low latency.
 */
export async function routeMessage(
  message: string,
  options: ChatOptions = {}
): Promise<'persona' | 'general'> {
  const systemPrompt = `You classify user messages for an AI influencer platform.
Reply with exactly one word: "persona" or "general".
- persona: user is talking TO the influencer, wants in-character reply, DMs, comments, roleplay, storyline, caption in influencer voice.
- general: user is asking about the platform, how to use it, what a feature does, support, help, "how do I...", "what is...".
Reply only the word, nothing else.`
  const content = await chat(
    [{ role: 'user', content: message }],
    systemPrompt,
    { ...options, model: options.model ?? process.env.OPENAI_ROUTER_MODEL ?? 'gpt-4o-mini', maxTokens: 10, temperature: 0 }
  )
  const normalized = content.toLowerCase().trim()
  if (normalized.includes('persona')) return 'persona'
  if (normalized.includes('general')) return 'general'
  return 'general'
}
