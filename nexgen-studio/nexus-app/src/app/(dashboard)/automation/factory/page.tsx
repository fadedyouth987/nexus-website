'use client'

import { useState } from 'react'
import Link from 'next/link'
import apiFetch from '@/lib/core/api'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type FactoryResult = {
  ok: boolean
  creator?: { id: string; mode: 'legacy' | 'v2' | 'none' }
  planId?: string
  contentItemsCount?: number
  schedulerQueue?: { queuedContent: number; queuedSchedules: number } | null
  monetizationOfferId?: string | null
}

type PipelineReport = {
  factory?: FactoryResult
  queueStep?: { skipped?: boolean; queuedContent?: number; queuedSchedules?: number; detail?: string }
  dispatchStep?: { dispatched?: number; skipped?: number; queueEnabled?: boolean }
  optimizeStep?: { updated?: boolean; detail?: string }
}

export default function FactoryPage() {
  const [name, setName] = useState('')
  const [niche, setNiche] = useState('')
  const [personality, setPersonality] = useState('confident, witty')
  const [speechStyle, setSpeechStyle] = useState('short viral captions')
  const [platforms, setPlatforms] = useState('instagram,tiktok')
  const [contentRating, setContentRating] = useState<'sfw' | 'nsfw'>('sfw')
  const [modelSource, setModelSource] = useState<'builtin' | 'custom'>('builtin')
  const [customModelSource, setCustomModelSource] = useState('')
  const [monetizationStrategy, setMonetizationStrategy] = useState('subscription + paid shoutouts')
  const [postingFrequency, setPostingFrequency] = useState('1')
  const [loading, setLoading] = useState(false)
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FactoryResult | null>(null)
  const [pipelineReport, setPipelineReport] = useState<PipelineReport | null>(null)

  const runFactory = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const response = await apiFetch('/automation/factory', {
        method: 'POST',
        body: JSON.stringify({
          persona: {
            name,
            niche,
            personality,
            speech_style: speechStyle,
            catchphrases: [],
            posting_frequency: Number(postingFrequency || '1'),
            monetization_strategy: monetizationStrategy,
            audience_type: 'social growth audience',
            tone: personality,
            platforms: platforms
              .split(',')
              .map((p) => p.trim().toLowerCase())
              .filter(Boolean),
            content_rating: contentRating,
            model_source: modelSource,
            custom_model_source: customModelSource || undefined,
          },
        }),
      })
      const data = (await response.json().catch(() => ({}))) as FactoryResult & { detail?: string }
      if (!response.ok) {
        throw new Error(data.detail || 'Factory failed')
      }
      setResult(data)
      setPipelineReport(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Factory failed')
    } finally {
      setLoading(false)
    }
  }

  const runFullPipeline = async () => {
    setPipelineLoading(true)
    setError(null)
    setPipelineReport(null)
    setResult(null)
    try {
      const factoryRes = await apiFetch('/automation/factory', {
        method: 'POST',
        body: JSON.stringify({
          persona: {
            name,
            niche,
            personality,
            speech_style: speechStyle,
            catchphrases: [],
            posting_frequency: Number(postingFrequency || '1'),
            monetization_strategy: monetizationStrategy,
            audience_type: 'social growth audience',
            tone: personality,
            platforms: platforms
              .split(',')
              .map((p) => p.trim().toLowerCase())
              .filter(Boolean),
            content_rating: contentRating,
            model_source: modelSource,
            custom_model_source: customModelSource || undefined,
          },
        }),
      })
      const factoryData = (await factoryRes.json().catch(() => ({}))) as FactoryResult & { detail?: string }
      if (!factoryRes.ok || !factoryData.planId) {
        throw new Error(factoryData.detail || 'Factory step failed')
      }
      setResult(factoryData)

      let queueStep: PipelineReport['queueStep'] = { skipped: true, detail: 'Queue skipped (already queued by factory or non-v2 mode).' }
      if (!factoryData.schedulerQueue || (factoryData.schedulerQueue.queuedSchedules ?? 0) === 0) {
        const queueRes = await apiFetch(`/plans/${factoryData.planId}/automation/queue`, {
          method: 'POST',
          body: JSON.stringify({}),
        })
        const queueData = (await queueRes.json().catch(() => ({}))) as { queuedContent?: number; queuedSchedules?: number; detail?: string }
        if (!queueRes.ok) {
          throw new Error(queueData.detail || 'Queue step failed')
        }
        queueStep = {
          skipped: false,
          queuedContent: queueData.queuedContent || 0,
          queuedSchedules: queueData.queuedSchedules || 0,
        }
      }

      const dispatchRes = await apiFetch('/social/publish/dispatch-due', { method: 'POST' })
      const dispatchData = (await dispatchRes.json().catch(() => ({}))) as { dispatched?: number; skipped?: number; queueEnabled?: boolean; detail?: string }
      if (!dispatchRes.ok) {
        throw new Error(dispatchData.detail || 'Dispatch step failed')
      }

      const optimizeRes = await apiFetch(`/plans/${factoryData.planId}/optimize`, { method: 'POST' })
      const optimizeData = (await optimizeRes.json().catch(() => ({}))) as { updated?: boolean; detail?: string }
      if (!optimizeRes.ok) {
        throw new Error(optimizeData.detail || 'Optimize step failed')
      }

      setPipelineReport({
        factory: factoryData,
        queueStep,
        dispatchStep: {
          dispatched: dispatchData.dispatched || 0,
          skipped: dispatchData.skipped || 0,
          queueEnabled: dispatchData.queueEnabled,
        },
        optimizeStep: {
          updated: optimizeData.updated === true,
          detail: optimizeData.detail,
        },
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Full pipeline failed')
    } finally {
      setPipelineLoading(false)
    }
  }

  return (
    <div className="space-y-[var(--section-gap)]">
      <PageHeader
        title="AI Influencer Factory"
        description="Create influencer persona, generate 30-day strategy/calendar, and seed monetization in one flow."
      />

      <Card className="rounded-xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Factory Inputs</CardTitle>
          <CardDescription>
            This creates only missing assets in your current stack (creator + plan + strategy + calendar + offer draft).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <input className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder="Persona name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder="Niche" value={niche} onChange={(e) => setNiche(e.target.value)} />
          <input className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder="Personality traits" value={personality} onChange={(e) => setPersonality(e.target.value)} />
          <input className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder="Speech style" value={speechStyle} onChange={(e) => setSpeechStyle(e.target.value)} />
          <input className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder="Platforms comma-separated (instagram,tiktok,youtube)" value={platforms} onChange={(e) => setPlatforms(e.target.value)} />
          <input className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder="Monetization strategy" value={monetizationStrategy} onChange={(e) => setMonetizationStrategy(e.target.value)} />
          <input className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" type="number" min={1} max={6} placeholder="Posting frequency/day" value={postingFrequency} onChange={(e) => setPostingFrequency(e.target.value)} />
          <select className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={contentRating} onChange={(e) => setContentRating(e.target.value as 'sfw' | 'nsfw')}>
            <option value="sfw">SFW</option>
            <option value="nsfw">NSFW</option>
          </select>
          <select className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" value={modelSource} onChange={(e) => setModelSource(e.target.value as 'builtin' | 'custom')}>
            <option value="builtin">Built-in model</option>
            <option value="custom">Custom model</option>
          </select>
          <input className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring" placeholder="Custom model source (optional, e.g. civit.ai URL)" value={customModelSource} onChange={(e) => setCustomModelSource(e.target.value)} />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={() => void runFactory()} disabled={loading || !name.trim() || !niche.trim()}>
          {loading ? 'Running factory...' : 'Run Influencer Factory'}
        </Button>
        <Button onClick={() => void runFullPipeline()} disabled={pipelineLoading || !name.trim() || !niche.trim()}>
          {pipelineLoading ? 'Running full pipeline...' : 'Run Full Factory Pipeline'}
        </Button>
        <Button asChild variant="outline">
          <Link href="/automation">Back to Automation</Link>
        </Button>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      {result?.ok ? (
        <Card>
          <CardHeader>
            <CardTitle>Factory Result</CardTitle>
            <CardDescription>Your automated setup is complete.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Creator mode: {result.creator?.mode || 'none'}</div>
            <div>Plan ID: {result.planId}</div>
            <div>Generated content items: {result.contentItemsCount ?? 0}</div>
            <div>
              Scheduler queue: {result.schedulerQueue ? `${result.schedulerQueue.queuedContent} content / ${result.schedulerQueue.queuedSchedules} schedules` : 'not queued (requires v2 creator/workspace)'}
            </div>
            <div>Monetization offer: {result.monetizationOfferId || 'not created'}</div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/automation/planner">Open Planner</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/studio">Open Studio</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/automation/scheduler">Open Scheduler</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/monetization">Open Monetization</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {pipelineReport ? (
        <Card className="rounded-xl border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle>Full Pipeline Report</CardTitle>
            <CardDescription>{'Factory -> Queue -> Dispatch -> Optimize completed.'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>Plan: {pipelineReport.factory?.planId || 'N/A'}</div>
            <div>
              Queue step:{' '}
              {pipelineReport.queueStep?.skipped
                ? pipelineReport.queueStep.detail || 'Skipped'
                : `${pipelineReport.queueStep?.queuedContent || 0} content / ${pipelineReport.queueStep?.queuedSchedules || 0} schedules`}
            </div>
            <div>
              Dispatch step: {pipelineReport.dispatchStep?.dispatched || 0} dispatched, {pipelineReport.dispatchStep?.skipped || 0} skipped
              {pipelineReport.dispatchStep?.queueEnabled === false ? ' (queue disabled)' : ''}
            </div>
            <div>
              Optimize step:{' '}
              {pipelineReport.optimizeStep?.updated
                ? 'Strategy updated from analytics'
                : pipelineReport.optimizeStep?.detail || 'No optimization changes'}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

