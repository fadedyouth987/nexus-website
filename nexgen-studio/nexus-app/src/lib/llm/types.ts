/**
 * Dual-LLM types: Persona (in-character) vs General (platform help).
 */

export type LLMRole = 'system' | 'user' | 'assistant'

export interface LLMMessage {
  role: LLMRole
  content: string
}

export type LLMRoute = 'persona' | 'general'

/** Context for Persona LLM: influencer identity and conversation. */
export interface PersonaContext {
  influencerId: string
  influencerName: string
  /** Structured traits (from personality_json). */
  personality: Record<string, unknown>
  /** Backstory / lore (from lore_memory). */
  loreMemory: Record<string, unknown>
  /** Voice style description. */
  voiceStyle?: string | null
  /** Optional: legacy free-form system prompt. */
  personalitySystemPrompt?: string | null
  /** Recent posts/captions for continuity. */
  recentPosts?: string[]
  /** Recent conversation for context. */
  recentMessages?: LLMMessage[]
  /** Extra instructions (e.g. "reply as if to a comment on your latest reel"). */
  contextHint?: string
}

/** Request to Persona LLM. */
export interface PersonaLLMRequest {
  influencerId: string
  messages: LLMMessage[]
  context?: {
    recentPosts?: string[]
    recentMessages?: LLMMessage[]
    contextHint?: string
  }
}

/** Request to General LLM. */
export interface GeneralLLMRequest {
  messages: LLMMessage[]
  /** Optional: scope (e.g. "studio", "automation"). */
  scope?: string
}

/** Request to router: classify message intent. */
export interface RouterLLMRequest {
  message: string
}

export interface RouterLLMResponse {
  route: LLMRoute
  confidence?: number
}
