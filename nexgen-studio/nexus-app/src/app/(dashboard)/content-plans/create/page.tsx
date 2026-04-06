'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import apiFetch from '@/lib/core/api'
import { useWorkspace } from '@/context/WorkspaceContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { PlanItemsGrid, type PlanItemRow } from '@/components/autopilot/PlanItemsGrid'

type Influencer = {
  id: string
  name?: string | null
  display_name?: string | null
  handle?: string | null
}

export default function CreateContentPlanPage() {
  const { currentWorkspace } = useWorkspace()

  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [selectedInfluencer, setSelectedInfluencer] = useState('')
  const [niche, setNiche] = useState('')
  const [brandStyle, setBrandStyle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingInfluencers, setIsLoadingInfluencers] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [planId, setPlanId] = useState<string | null>(null)
  const [planStatus, setPlanStatus] = useState<string | null>(null)
  const [planItems, setPlanItems] = useState<PlanItemRow[]>([])

  const loadInfluencers = useCallback(async () => {
    if (!currentWorkspace?.id) {
      setInfluencers([])
      setSelectedInfluencer('')
      setIsLoadingInfluencers(false)
      return
    }

    setIsLoadingInfluencers(true)
    setError(null)

    try {
      const response = await apiFetch(`/workspaces/${currentWorkspace.id}/influencers`)
      const payload = await response.json().catch(() => [])
      if (!response.ok) {
        throw new Error((payload as { detail?: string })?.detail || 'Failed to load influencers')
      }

      const rows = Array.isArray(payload) ? (payload as Influencer[]) : []
      setInfluencers(rows)
      if (rows[0] && !selectedInfluencer) {
        setSelectedInfluencer(rows[0].id)
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load influencers')
    } finally {
      setIsLoadingInfluencers(false)
    }
  }, [currentWorkspace?.id, selectedInfluencer])

  useEffect(() => {
    void loadInfluencers()
  }, [loadInfluencers])

  const pollPlan = useCallback(async () => {
    if (!planId) return

    const response = await apiFetch(`/autopilot/30-day/${planId}`)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) return

    const plan = (payload as { plan?: { status?: string } }).plan
    const items = (payload as { items?: PlanItemRow[] }).items
    if (plan?.status) {
      setPlanStatus(plan.status)
    }
    if (Array.isArray(items)) {
      setPlanItems(items)
    }
  }, [planId])

  useEffect(() => {
    if (!planId) return
    void pollPlan()
    const timer = setInterval(() => {
      void pollPlan()
    }, 5000)
    return () => clearInterval(timer)
  }, [planId, pollPlan])

  const canSubmit = useMemo(
    () => Boolean(selectedInfluencer && niche.trim() && brandStyle.trim() && !isSubmitting),
    [selectedInfluencer, niche, brandStyle, isSubmitting]
  )

  const handleCreatePlan = async () => {
    if (!canSubmit) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await apiFetch('/autopilot/30-day', {
        method: 'POST',
        body: JSON.stringify({
          influencerId: selectedInfluencer,
          niche: niche.trim(),
          brandStyle: brandStyle.trim(),
          workspaceId: currentWorkspace?.id || null,
        }),
      })

      const rawPayload = await response.json().catch(() => ({}))
      const payload =
        rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
          ? (rawPayload as Record<string, unknown>)
          : {}
      if (!response.ok) {
        const detail = typeof payload.detail === 'string' ? payload.detail : ''
        throw new Error(detail || 'Failed to create 30-day plan')
      }

      const nextPlanId = typeof payload.planId === 'string' ? payload.planId : null
      if (!nextPlanId) {
        throw new Error('Plan ID missing from API response')
      }

      setPlanId(nextPlanId)
      setPlanStatus(typeof payload.status === 'string' ? payload.status : 'RUNNING')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create plan')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>30-Day Autopilot</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          ) : null}

          <div className="space-y-2">
            <label className="text-sm font-medium">Influencer</label>
            <Select value={selectedInfluencer || undefined} onValueChange={setSelectedInfluencer}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingInfluencers ? 'Loading influencers...' : 'Select influencer'} />
              </SelectTrigger>
              <SelectContent>
                {influencers.map((influencer) => (
                  <SelectItem key={influencer.id} value={influencer.id}>
                    {influencer.name || influencer.display_name || influencer.handle || influencer.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Niche</label>
            <Input
              value={niche}
              onChange={(event) => setNiche(event.target.value)}
              placeholder="e.g. Fitness, Beauty, AI tutorials"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Brand Style</label>
            <Textarea
              value={brandStyle}
              onChange={(event) => setBrandStyle(event.target.value)}
              placeholder="Describe tone, visual direction, and storytelling style"
              rows={4}
            />
          </div>

          <Button onClick={handleCreatePlan} disabled={!canSubmit}>
            {isSubmitting ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Plan...
              </span>
            ) : (
              'Generate 30-Day Plan'
            )}
          </Button>
        </CardContent>
      </Card>

      {planId ? (
        <Card>
          <CardHeader>
            <CardTitle>Plan Status: {planStatus || 'RUNNING'}</CardTitle>
          </CardHeader>
          <CardContent>
            {!planItems.length ? (
              <div className="text-sm text-muted-foreground">Waiting for plan items...</div>
            ) : (
              <PlanItemsGrid items={planItems} />
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
