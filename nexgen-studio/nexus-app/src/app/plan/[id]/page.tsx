'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import apiFetch from '@/lib/core/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, ArrowRight, UserPlus, ImageIcon, Share2, Zap } from 'lucide-react'

type PlanRow = {
  id: string
  name?: string
  status?: string
  duration_days?: number
  timezone?: string
}

type PlanPayload = {
  plan: PlanRow
  brief?: Record<string, unknown> | null
  strategy?: Record<string, unknown> | null
}

type PlanItem = {
  id?: string
  day_number: number
  platform?: string
  hook?: string
  angle?: string
  cta?: string
  status?: string
  publish_date?: string
}

export default function PlanResultPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const planId = useMemo(() => {
    const value = params?.id
    return Array.isArray(value) ? value[0] || '' : value || ''
  }, [params])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [planPayload, setPlanPayload] = useState<PlanPayload | null>(null)
  const [items, setItems] = useState<PlanItem[]>([])
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackRating, setFeedbackRating] = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      const callback = planId ? `/plan/${planId}` : '/onboarding'
      router.replace(`/auth?callbackUrl=${encodeURIComponent(callback)}`)
    }
  }, [status, router, planId])

  const loadPlan = useCallback(async () => {
    if (!planId) {
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [planRes, itemsRes] = await Promise.all([
        apiFetch(`/plans/${planId}`),
        apiFetch(`/plans/${planId}/content-items`),
      ])

      const planBody = await planRes.json().catch(() => ({}))
      const itemBody = await itemsRes.json().catch(() => ({}))

      if (!planRes.ok) {
        throw new Error(
          planBody && typeof planBody === 'object' && 'detail' in planBody && typeof (planBody as any).detail === 'string'
            ? (planBody as any).detail
            : 'Failed to load plan'
        )
      }
      if (!itemsRes.ok) {
        throw new Error(
          itemBody && typeof itemBody === 'object' && 'detail' in itemBody && typeof (itemBody as any).detail === 'string'
            ? (itemBody as any).detail
            : 'Failed to load plan items'
        )
      }

      const parsedPlan = planBody && typeof planBody === 'object' ? (planBody as PlanPayload) : null
      const parsedItems = itemBody && typeof itemBody === 'object' && Array.isArray((itemBody as any).items)
        ? ((itemBody as any).items as PlanItem[])
        : []

      setPlanPayload(parsedPlan)
      setItems(parsedItems)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }, [planId])

  useEffect(() => {
    if (status === 'authenticated' && planId) {
      void loadPlan()
    }
  }, [status, planId, loadPlan])

  const handleExportJson = async () => {
    if (!planPayload || !planId) {
      return
    }

    const blob = new Blob(
      [
        JSON.stringify(
          {
            exported_at: new Date().toISOString(),
            plan: planPayload.plan,
            brief: planPayload.brief ?? null,
            strategy: planPayload.strategy ?? null,
            items,
          },
          null,
          2
        ),
      ],
      { type: 'application/json' }
    )

    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `plan-${planId}.json`
    link.click()
    URL.revokeObjectURL(objectUrl)

    await apiFetch('/mvp/feedback', {
      method: 'POST',
      body: JSON.stringify({
        action: 'export_clicked',
        planId,
        path: `/plan/${planId}`,
        context: 'json_export',
      }),
    })
  }

  const handleShare = async () => {
    if (!planId || typeof window === 'undefined') {
      return
    }

    const url = window.location.href
    let context = 'navigator_share'

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'My 30-day content plan',
          url,
        })
        setShareMessage('Share sheet opened.')
      } else {
        context = 'clipboard_copy'
        await navigator.clipboard.writeText(url)
        setShareMessage('Plan link copied to clipboard.')
      }
    } catch {
      setShareMessage('Unable to share right now.')
      return
    }

    await apiFetch('/mvp/feedback', {
      method: 'POST',
      body: JSON.stringify({
        action: 'share_clicked',
        planId,
        path: `/plan/${planId}`,
        context,
      }),
    })
  }

  const handleFeedbackSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!planId) {
      return
    }

    setFeedbackSubmitting(true)
    setFeedbackStatus(null)
    try {
      const ratingValue =
        feedbackRating.trim().length > 0 ? Math.max(1, Math.min(5, Number(feedbackRating) || 0)) : null

      const response = await apiFetch('/mvp/feedback', {
        method: 'POST',
        body: JSON.stringify({
          action: 'feedback_submitted',
          planId,
          path: `/plan/${planId}`,
          message: feedbackMessage.trim() || undefined,
          rating: ratingValue || undefined,
          context: 'plan_result_feedback',
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === 'object' && 'detail' in payload && typeof (payload as any).detail === 'string'
            ? (payload as any).detail
            : 'Failed to submit feedback'
        )
      }

      setFeedbackStatus('Feedback sent. Thank you.')
      setFeedbackMessage('')
      setFeedbackRating('')
    } catch (submitError) {
      setFeedbackStatus(submitError instanceof Error ? submitError.message : 'Failed to submit feedback')
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Generated 30-day plan</h1>
          <p className="text-sm text-muted-foreground">
            Review, export, and share. You can re-run onboarding for a new version anytime.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleShare}>
            Share plan link
          </Button>
          <Button onClick={handleExportJson}>Export JSON</Button>
          <Button variant="ghost" asChild>
            <Link href="/onboarding">New onboarding run</Link>
          </Button>
        </div>
      </div>

      {shareMessage ? (
        <p className="text-sm text-muted-foreground">{shareMessage}</p>
      ) : null}

      {error ? (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{planPayload?.plan?.name || 'Untitled plan'}</CardTitle>
          <CardDescription>
            Plan ID: {planId}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">{planPayload?.plan?.status || 'draft'}</Badge>
          <Badge variant="outline">{planPayload?.plan?.duration_days || 30} days</Badge>
          <Badge variant="outline">{planPayload?.plan?.timezone || 'UTC'}</Badge>
          <Badge variant="outline">{items.length} items</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan output</CardTitle>
          <CardDescription>First 30-day calendar generated from your onboarding brief.</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items available for this plan yet.</p>
          ) : (
            <div className="max-h-[520px] space-y-2 overflow-y-auto">
              {items.map((item) => (
                <div key={`${item.id || 'row'}-${item.day_number}`} className="rounded-md border border-border bg-muted/20 p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">Day {item.day_number}</Badge>
                    {item.platform ? <Badge variant="secondary">{item.platform}</Badge> : null}
                    {item.publish_date ? <span>{item.publish_date}</span> : null}
                    {item.status ? <span>Status: {item.status}</span> : null}
                  </div>
                  {item.hook ? <p className="text-sm font-medium text-foreground">{item.hook}</p> : null}
                  {item.angle ? <p className="text-xs text-muted-foreground">{item.angle}</p> : null}
                  {item.cta ? <p className="mt-1 text-xs text-muted-foreground">CTA: {item.cta}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Best next step
          </div>
          <CardTitle className="mt-2 text-xl">Turn your plan into action</CardTitle>
          <CardDescription>
            You have a 30-day content plan. Here is the recommended path to bring it to life.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/creators/create"
              className="group rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserPlus className="h-5 w-5" />
              </div>
              <h4 className="mt-3 font-semibold text-foreground">1. Create creator</h4>
              <p className="mt-1 text-xs text-muted-foreground">Set up the AI influencer persona</p>
              <div className="mt-3 flex items-center text-xs font-medium text-primary">
                Start <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link
              href="/studio"
              className="group rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ImageIcon className="h-5 w-5" />
              </div>
              <h4 className="mt-3 font-semibold text-foreground">2. Generate content</h4>
              <p className="mt-1 text-xs text-muted-foreground">Create images for your plan days</p>
              <div className="mt-3 flex items-center text-xs font-medium text-primary">
                Open Studio <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link
              href="/dashboard/social"
              className="group rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Share2 className="h-5 w-5" />
              </div>
              <h4 className="mt-3 font-semibold text-foreground">3. Connect platforms</h4>
              <p className="mt-1 text-xs text-muted-foreground">Link Instagram, TikTok, etc.</p>
              <div className="mt-3 flex items-center text-xs font-medium text-primary">
                Connect <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link
              href="/automation/factory"
              className="group rounded-xl border border-primary/30 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="h-5 w-5" />
              </div>
              <h4 className="mt-3 font-semibold text-foreground">Or: Run full factory</h4>
              <p className="mt-1 text-xs text-muted-foreground">Do steps 1-3 automatically</p>
              <div className="mt-3 flex items-center text-xs font-medium text-primary">
                Auto-setup <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Feedback</CardTitle>
          <CardDescription>
            Tell us what worked or failed. This feeds the beta roadmap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFeedbackSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="feedback-rating">Rating (1-5, optional)</Label>
              <Input
                id="feedback-rating"
                type="number"
                min={1}
                max={5}
                value={feedbackRating}
                onChange={(e) => setFeedbackRating(e.target.value)}
                placeholder="5"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback-message">Feedback</Label>
              <Textarea
                id="feedback-message"
                rows={4}
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="What should we improve in the onboarding or 30-day output?"
              />
            </div>
            <Button type="submit" disabled={feedbackSubmitting}>
              {feedbackSubmitting ? 'Sending...' : 'Send feedback'}
            </Button>
            {feedbackStatus ? <p className="text-sm text-muted-foreground">{feedbackStatus}</p> : null}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
