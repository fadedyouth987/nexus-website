'use client'

import { useState, useCallback } from 'react'
import type { LLMMessage } from '@/lib/llm/types'

export interface UseGeneralLLMOptions {
  scope?: string
}

export interface UseGeneralLLMResult {
  reply: string | null
  error: string | null
  isLoading: boolean
  send: (messages: LLMMessage[]) => Promise<string | null>
  ask: (question: string) => Promise<string | null>
  reset: () => void
}

export function useGeneralLLM(options: UseGeneralLLMOptions = {}): UseGeneralLLMResult {
  const { scope } = options
  const [reply, setReply] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const send = useCallback(
    async (messages: LLMMessage[]): Promise<string | null> => {
      setError(null)
      setReply(null)
      setIsLoading(true)
      try {
        const res = await fetch('/api/llm/general', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, scope: scope ?? undefined }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const msg = typeof data.detail === 'string' ? data.detail : 'General LLM failed'
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
    [scope]
  )

  const ask = useCallback(
    (question: string): Promise<string | null> =>
      send([{ role: 'user', content: question.trim() }]),
    [send]
  )

  const reset = useCallback(() => {
    setReply(null)
    setError(null)
  }, [])

  return { reply, error, isLoading, send, ask, reset }
}
