'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Wand2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import apiFetch from '@/lib/core/api'
import { useWorkspace } from '@/context/WorkspaceContext'
import { AppHero } from '@/components/layout/AppHero'

type AutomationTileProps = {
  title: string
  description: string
  href?: string
  badge?: string
}

function AutomationTile({ title, description, href, badge }: AutomationTileProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6">{description}</CardDescription>
          </div>
          {badge ? (
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
              {badge}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="mt-auto">
        {href ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={href}>Open flow</Link>
          </Button>
        ) : (
          <Button size="sm" disabled variant="outline">
            Coming soon
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

export default function AutomationPage() {
  const { currentWorkspace } = useWorkspace()
  const [prompt, setPrompt] = useState('')
  const [reply, setReply] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [contextLoading, setContextLoading] = useState(false)
  const [creatorNiche, setCreatorNiche] = useState<string | null>(null)
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false

    async function loadSuggestionContext() {
      setContextLoading(true)
      try {
        const [creatorsRes, accountsRes] = await Promise.all([
          apiFetch(
            currentWorkspace?.id
              ? `/creators?workspace_id=${encodeURIComponent(currentWorkspace.id)}`
              : '/creators'
          ),
          apiFetch('/social/accounts'),
        ])

        if (creatorsRes.ok) {
          const creatorsPayload = (await creatorsRes.json()) as
            | Array<{ niche?: string | null }>
            | { items?: Array<{ niche?: string | null }> }
          const creators = Array.isArray(creatorsPayload) ? creatorsPayload : (creatorsPayload.items ?? [])
          const niche = creators.find((creator) => creator.niche && String(creator.niche).trim())?.niche
          if (!cancelled) setCreatorNiche(niche ? String(niche) : null)
        }

        if (accountsRes.ok) {
          const accounts = (await accountsRes.json()) as Array<{ provider?: string }>
          const providers = Array.from(
            new Set(
              (accounts ?? [])
                .map((account) => String(account.provider || '').trim().toLowerCase())
                .filter(Boolean)
            )
          )
          if (!cancelled) setConnectedPlatforms(providers)
        }
      } catch {
        if (!cancelled) {
          setCreatorNiche(null)
          setConnectedPlatforms([])
        }
      } finally {
        if (!cancelled) setContextLoading(false)
      }
    }

    void loadSuggestionContext()
    return () => {
      cancelled = true
    }
  }, [currentWorkspace?.id])

  const suggestions = useMemo(() => {
    const niche = creatorNiche || 'AI lifestyle creator'
    const platforms = connectedPlatforms.length
      ? connectedPlatforms.slice(0, 3).join(' + ')
      : 'TikTok + Instagram'
    const workspaceHint = currentWorkspace?.name ? `workspace: ${currentWorkspace.name}` : 'solo workspace'

    return [
      `Niche: ${niche}, platforms: ${platforms}, posting cadence: daily (${workspaceHint})`,
      'Content rating: SFW or NSFW, include exact audience target and conversion goal for 30 days',
      'Model source: use platform model / Civitai model / custom upload, include style references',
      'Monetization path: hook -> trust builder -> teaser -> link in bio -> paid offer',
    ]
  }, [connectedPlatforms, creatorNiche, currentWorkspace?.name])

  async function runQuickPrompt() {
    const message = prompt.trim()
    if (!message || loading) return
    setLoading(true)
    setError(null)
    setReply(null)
    try {
      const res = await apiFetch('/planner/chat', {
        method: 'POST',
        body: JSON.stringify({ message }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { detail?: string }).detail || 'Could not run prompt.')
        return
      }
      setReply((data as { reply?: string }).reply || 'Planner received your brief.')
    } catch {
      setError('Planner request failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Automation"
        title="Orchestrate your creator engine"
        description="Plan, generate, schedule, engage, and monetize in one matching workspace. The first-wave automation surfaces now use the same visual system as landing while keeping your existing planner and data flows intact."
        actions={
          <>
            <Button asChild size="lg">
              <Link href="/automation/planner">Open planner</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/automation/factory">Open factory</Link>
            </Button>
          </>
        }
        metrics={[
          { label: 'Workspace', value: currentWorkspace?.name || 'Solo' },
          { label: 'Connected platforms', value: connectedPlatforms.length || 0 },
          { label: 'Primary niche', value: creatorNiche || 'Set in planner' },
        ]}
        media={
          <Image
            src="/app/automation-orbit.svg"
            alt="Automation hub artwork"
            width={1400}
            height={980}
            className="h-auto w-full rounded-[24px]"
          />
        }
      />

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wand2 className="h-5 w-5" />
            Content LLM quick brief
          </CardTitle>
          <CardDescription>
            Give direction once. The planner will ask for missing details and turn the brief into an automation-ready strategy.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your creator direction, content goals, target audience, platforms, SFW/NSFW preference, and model source..."
            className="min-h-[140px] w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                className="rounded-full border border-border bg-muted/40 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setPrompt((prev) => (prev ? `${prev}\n- ${item}` : `- ${item}`))}
              >
                + {item}
              </button>
            ))}
          </div>
          {contextLoading ? (
            <p className="text-[11px] text-muted-foreground">
              Updating suggestions from creators and connected platforms...
            </p>
          ) : null}
          <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
            <Input value={`${prompt.length} characters`} readOnly className="h-10 text-xs text-muted-foreground" />
            <Button onClick={() => void runQuickPrompt()} disabled={loading || !prompt.trim()}>
              {loading ? 'Running...' : 'Run in content LLM'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/automation/planner">Open full planner</Link>
            </Button>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          {reply ? (
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-foreground">
              {reply}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AutomationTile
          title="AI Influencer Factory"
          description="Create persona, generate 30-day strategy and calendar, and seed monetization from one flow."
          href="/automation/factory"
          badge="Factory"
        />
        <AutomationTile
          title="Content planner"
          description="Describe your niche in chat. AI builds a content calendar you can refine by conversation."
          href="/automation/planner"
          badge="Planner"
        />
        <AutomationTile
          title="Content automation"
          description="Ideas, scripts, captions, 30-day plans, and series development in one surface."
          href="/studio"
          badge="Studio"
        />
        <AutomationTile
          title="Media automation"
          description="Image and video generation, batch jobs, seed control, and upscaling."
          href="/studio"
          badge="Studio"
        />
        <AutomationTile
          title="Planning and queue"
          description="Manage content timing, queue state, and post readiness from the planner flow."
          href="/automation/planner"
          badge="Planner queue"
        />
        <AutomationTile
          title="Engagement automation"
          description="Inbox workspace for connected accounts, threads, and assisted replies."
          href="/inbox"
          badge="Inbox beta"
        />
        <AutomationTile
          title="Analytics automation"
          description="Performance insights and workspace reporting with clear availability labels."
          href="/analytics"
          badge="Analytics beta"
        />
        <AutomationTile
          title="Monetization and Vault"
          description="Billing controls and Vault gating available now, with broader monetization modules in progress."
          href="/monetization"
          badge="Billing + Vault"
        />
        <AutomationTile
          title="Agency automation"
          description="Multi-creator workflows, permissions, reporting, and bulk execution."
          href="/agency"
          badge="Agency"
        />
      </div>
    </div>
  )
}
