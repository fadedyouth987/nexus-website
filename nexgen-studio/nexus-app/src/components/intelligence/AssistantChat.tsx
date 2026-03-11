'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useGeneralLLM } from '@/hooks/useGeneralLLM'
import { Send, Loader2, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/core/utils'

export interface AssistantChatProps {
  /** Context scope for the assistant (e.g. "intelligence", "studio"). */
  scope?: string
  /** Optional title. */
  title?: string
  /** Optional class for the container. */
  className?: string
  /** Whether to show as a compact floating panel. */
  compact?: boolean
}

type Message = { role: 'user' | 'assistant'; content: string }

export function AssistantChat({ scope, title = 'Nexus', className, compact }: AssistantChatProps) {
  const { ask, error, isLoading, reset } = useGeneralLLM({ scope })
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    const assistantReply = await ask(text)
    if (assistantReply) {
      setMessages((prev) => [...prev, { role: 'assistant', content: assistantReply }])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-lg border border-border bg-card',
        compact ? 'w-full max-w-md' : 'min-h-[320px]',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
          {title}
        </span>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              reset()
              setMessages([])
            }}
          >
            Clear
          </Button>
        )}
      </div>
      <ScrollArea className={cn('flex-1 p-3', compact ? 'max-h-[240px]' : 'min-h-[200px]')}>
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-6">
            Ask Nexus about analytics, automation, or platform help.
          </p>
        )}
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                'rounded-lg px-3 py-2 text-sm',
                m.role === 'user'
                  ? 'ml-4 bg-primary text-primary-foreground'
                  : 'mr-4 bg-muted text-foreground'
              )}
            >
              {m.content}
            </div>
          ))}
          {error && (
            <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>
        <div ref={scrollRef} />
      </ScrollArea>
      <div className="border-t border-border p-2">
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="min-h-[36px] resize-none text-sm"
            disabled={isLoading}
          />
          <Button
            size="icon"
            className="shrink-0 h-9 w-9"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
