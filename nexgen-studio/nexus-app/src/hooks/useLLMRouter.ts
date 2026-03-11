'use client'

import { useState, useCallback } from 'react'
import type { LLMRoute } from '@/lib/llm/types'

export interface UseLLMRouterResult {
  route: LLMRoute | null
  error: string | null
  isLoading: boolean
  classify: (message: string) => Promise<LLMRoute | null>
  reset: () => void
}

/**
 * Optional: classify a message to decide whether to call Persona or General LLM.
 * Use when you want automatic routing (e.g. single chat input).
 */
export function useLLMRouter(): UseLLMRouterResult {
  const [route, setRoute] = useState<LLMRoute | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const classify = useCallback(async (message: string): Promise<LLMRoute | null> => {
    const trimmed = message.trim()
    if (!trimmed) {
      setRoute('general')
      return 'general'
    }
    setError(null)
    setRoute(null)
    setIsLoading(true)
    try {
      const res = await fetch('/api/llm/router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = typeof data.detail === 'string' ? data.detail : 'Router failed'
        setError(msg)
        return null
      }
      const r = data.route === 'persona' ? 'persona' : 'general'
      setRoute(r)
      return r
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      setError(msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setRoute(null)
    setError(null)
  }, [])

  return { route, error, isLoading, classify, reset }
}
