'use client'

import { useState, useCallback } from 'react'
import type { LLMMessage } from '@/lib/llm/types'

export interface PersonaLLMContext {
  recentPosts?: string[]
  recentMessages?: LLMMessage[]
  contextHint?: string
}

export interface UsePersonaLLMOptions {
  influencerId: string
  context?: PersonaLLMContext
}

export interface UsePersonaLLMResult {
  reply: string | null
  error: string | null
  isLoading: boolean
  send: (messages: LLMMessage[]) => Promise<string | null>
  reset: () => void
}

export function usePersonaLLM(options: UsePersonaLLMOptions): UsePersonaLLMResult {
  const { influencerId, context } = options
  const [reply, setReply] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const send = useCallback(
    async (messages: LLMMessage[]): Promise<string | null> => {
      if (!influencerId) {
        setError('influencerId is required')
        return null
      }
      setError(null)
      setReply(null)
      setIsLoading(true)
      try {
        const res = await fetch('/api/llm/persona', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            influencerId,
            messages,
            context: context ?? undefined,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = typeof data.detail === 'string' ? data.detail : 'Persona LLM failed'
          setError(msg)
          return null
        }
        const out = typeof data.reply === 'string' ? data.reply : ''
        setReply(out)
        return out
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Request failed'
        setError(msg)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [influencerId, context]
  )

  const reset = useCallback(() => {
    setReply(null)
    setError(null)
  }, [])

  return { reply, error, isLoading, send, reset }
}
