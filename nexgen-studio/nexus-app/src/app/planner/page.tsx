'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react'
import { AppHero } from '@/components/layout/AppHero'
import { NextStepBanner } from '@/components/layout/NextStepBanner'
import { Button } from '@/components/ui/button'
import { ChatPanel, type ChatMessage } from '@/components/planner/ChatPanel'
import { PlanBuilderPanel, type PlanSummary } from '@/components/planner/PlanBuilderPanel'
import type { ContentItem } from '@/components/planner/CalendarGrid'
import apiFetch from '@/lib/core/api'

type PlannerPageProps = {
  embedded?: boolean
}

export default function PlannerPage({ embedded = false }: PlannerPageProps) {
  const { status } = useSession()
  const router = useRouter()
  const [threadId, setThreadId] = useState<string | null>(null)
  const [planId, setPlanId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null)
  const [contentItems, setContentItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadPlanLoading, setLoadPlanLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
    }
  }, [status, router])

  const loadPlan = useCallback(async (pid: string) => {
    if (!pid) return
    setLoadPlanLoading(true)
    setError(null)
    try {
      const [planRes, itemsRes] = await Promise.all([
        apiFetch(`/plans/${pid}`),
        apiFetch(`/plans/${pid}/content-items`),
      ])
      if (planRes.ok) {
        const data = (await planRes.json()) as { plan: Record<string, unknown>; brief: unknown; strategy: unknown }
        setPlanSummary({
          id: data.plan.id as string,
          name: data.plan.name as string,
          status: data.plan.status as string,
          duration_days: data.plan.duration_days as number,
          timezone: data.plan.timezone as string,
          brief: data.brief as Record<string, unknown>,
          strategy: data.strategy as Record<string, unknown>,
        })
      }
      if (itemsRes.ok) {
        const data = (await itemsRes.json()) as { items: ContentItem[] }
        setContentItems(data.items ?? [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plan')
    } finally {
      setLoadPlanLoading(false)
    }
  }, [])

  useEffect(() => {
    if (planId && !planSummary) {
      void loadPlan(planId)
    }
  }, [planId, planSummary, loadPlan])

  const handleSend = async (message: string) => {
    setLoading(true)
    setError(null)
    setMessages((prev) => [...prev, { role: 'user', content: message }])
    try {
      const res = await apiFetch('/planner/chat', {
        method: 'POST',
        body: JSON.stringify({
          threadId: threadId ?? undefined,
          planId: planId ?? undefined,
          message,
        }),
      })
      const payload = await res.json().catch(() => ({}))
      const data = payload && typeof payload === 'object' ? (payload as Record<string, any>) : {}
      if (!res.ok) {
        setMessages((prev) => prev.slice(0, -1))
        setError((data.detail as string) || 'Failed to send')
        return
      }
      setThreadId(data.threadId ?? threadId)
      setPlanId(data.planId ?? planId)
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply ?? '' }])
      if (data.planSummary) {
        setPlanSummary({
          id: data.planSummary.id,
          name: data.planSummary.name,
          status: data.planSummary.status,
          duration_days: data.planSummary.duration_days,
          timezone: data.planSummary.timezone,
          brief: data.planSummary.brief,
          strategy: data.planSummary.strategy,
        })
      }
      if (data.contentItems && data.contentItems.length > 0) {
        setContentItems(data.contentItems)
      }
      if (data.strategy && planSummary) {
        setPlanSummary((p) => (p ? { ...p, strategy: data.strategy } : null))
      }
    } catch (e) {
      setMessages((prev) => prev.slice(0, -1))
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const handleNewPlan = () => {
    setThreadId(null)
    setPlanId(null)
    setMessages([])
    setPlanSummary(null)
    setContentItems([])
    setError(null)
  }

  const handleRegenerateRange = async (fromDay: number, toDay: number, instruction: string) => {
    if (!planId) return
    setLoadPlanLoading(true)
    try {
      const res = await apiFetch(`/plans/${planId}/calendar/regenerate-range`, {
        method: 'POST',
        body: JSON.stringify({ fromDay, toDay, instruction }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.updated) {
        const fullRes = await apiFetch(`/plans/${planId}/content-items`)
        const fullData = (await fullRes.json()) as { items: ContentItem[] }
        setContentItems(fullData.items ?? [])
      }
    } finally {
      setLoadPlanLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-6">
      {!embedded && (
        <AppHero
          eyebrow="Automation"
          title="Content Planner"
          description="Start with SFW vs NSFW (NSFW is 18+ gated), then describe your niche. The AI builds a content calendar you can refine by conversation."
          actions={
            <Button variant="outline" size="lg" asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          }
        />
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid flex-1 gap-6 lg:grid-cols-[400px_1fr] min-h-0">
        <div className="min-h-[400px] lg:min-h-0">
          <ChatPanel
            messages={messages}
            loading={loading}
            onSend={handleSend}
            threadId={threadId}
            planId={planId}
            onNewPlan={handleNewPlan}
          />
        </div>
        <div className="min-h-0 overflow-y-auto">
          <PlanBuilderPanel
            planSummary={planSummary}
            contentItems={contentItems}
            planId={planId}
            onRegenerateRange={handleRegenerateRange}
            loading={loadPlanLoading}
          />
        </div>
      </div>

      <NextStepBanner currentPhase={4} nextLabel="View Calendar" nextHref="/calendar" nextIcon={Calendar} />
    </div>
  )
}
