'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building,
  Calendar,
  CheckCircle2,
  Clock3,
  DollarSign,
  Eye,
  Factory,
  Images,
  Loader2,
  Megaphone,
  Pencil,
  Rocket,
  Share2,
  Sparkles,
  Star,
  TrendingUp,
  Users2,
  Video,
  type LucideIcon,
} from 'lucide-react'
import apiFetch from '@/lib/core/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useWorkspace } from '@/context/WorkspaceContext'
import { AppHero } from '@/components/layout/AppHero'
import { GettingStartedChecklist } from '@/components/onboarding/GettingStartedChecklist'
import { SaaSOverviewGrid } from '@/components/dashboard/SaaSOverviewGrid'

type PhaseCardData = {
  phase: number
  label: string
  description: string
  icon: LucideIcon
  stat: string | number
  statLabel: string
  href: string
  cta: string
  pages: Array<{ label: string; href: string }>
}

function PhaseCard({ data }: { data: PhaseCardData }) {
  const Icon = data.icon
  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-lg">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
            {data.phase}
          </span>
        </div>

        <div className="mt-3">
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{data.label}</h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{data.description}</p>
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-foreground">{data.stat}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{data.statLabel}</div>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
            <Link href={data.href}>
              {data.cta}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border/50 pt-3">
          {data.pages.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {page.label}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingDashboard() {
  return (
    <div className="space-y-[var(--section-gap)]">
      <div className="app-hero-shell space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-14 w-96" />
        <Skeleton className="h-4 w-[34rem]" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-52 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function SpotlightPanel({
  workspaceName,
  creatorCount,
  scheduledCount,
}: {
  workspaceName: string
  creatorCount: number
  scheduledCount: number
}) {
  const milestones = [
    { label: 'Brand identity locked', value: `${creatorCount || 0} creators live`, icon: Users2 },
    { label: 'Content engine active', value: `${scheduledCount || 0} posts lined up`, icon: Clock3 },
    { label: 'Publishing momentum', value: 'Studio, planner, and socials connected', icon: TrendingUp },
  ]

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/15 bg-[linear-gradient(135deg,rgba(7,16,33,0.98),rgba(11,49,83,0.92)_55%,rgba(18,114,102,0.82))] p-6 text-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.95)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.16),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(125,211,252,0.16),transparent_30%)]" />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100">
              <Megaphone className="h-3.5 w-3.5" />
              Creator Campaign Engine
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              {workspaceName} is set up to sell the platform, not just manage it.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-200/88">
              Turn your dashboard into a proof point for clients and creators: launch characters, generate premium visuals,
              and move from concept to scheduled campaigns in a single workspace.
            </p>
          </div>
          <div className="hidden rounded-2xl border border-white/10 bg-white/10 p-3 sm:block">
            <Rocket className="h-5 w-5 text-sky-100" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {milestones.map((milestone) => {
            const Icon = milestone.icon
            return (
              <div key={milestone.label} className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sky-100">
                  <Icon className="h-4 w-4" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Signal</span>
                </div>
                <div className="mt-3 text-sm font-medium text-white">{milestone.label}</div>
                <div className="mt-1 text-xs text-slate-200/80">{milestone.value}</div>
              </div>
            )
          })}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/10 p-4">
            <div className="flex items-center gap-2 text-emerald-100">
              <Star className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Premium positioning</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-emerald-50/95">
              The workflow now reads like a creator OS: identity, generation, assets, automation, publishing, and growth.
            </p>
          </div>
          <div className="rounded-2xl border border-sky-300/15 bg-sky-300/10 p-4">
            <div className="flex items-center gap-2 text-sky-100">
              <Eye className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Client-ready story</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-100/95">
              Every section frames the product around output and revenue, so the dashboard feels closer to a high-end SaaS homepage.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ValueCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <Card className="border-border/60 bg-card/80 shadow-sm">
      <CardContent className="p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const { currentWorkspace } = useWorkspace()
  const router = useRouter()

  const [stats, setStats] = useState({
    creators: 0,
    assets: 0,
    scheduled: 0,
    plans: 0,
    credits: '-' as string | number,
    socials: 0,
  })

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth')
  }, [status, router])

  useEffect(() => {
    if (!currentWorkspace) return
    const fetchData = async () => {
      try {
        const [infRes, postsRes, billingRes, plansRes, accountsRes] = await Promise.all([
          apiFetch(`/workspaces/${currentWorkspace.id}/influencers`).catch(() => null),
          apiFetch(`/workspaces/${currentWorkspace.id}/posts?status=scheduled`).catch(() => null),
          apiFetch('/billing/me').catch(() => null),
          apiFetch(`/plans?workspace_id=${currentWorkspace.id}`).catch(() => null),
          fetch('/api/social/accounts', { credentials: 'include' }).catch(() => null),
        ])

        const update: Partial<typeof stats> = {}

        if (infRes?.ok) {
          const data = await infRes.json().catch(() => [])
          update.creators = Array.isArray(data) ? data.length : 0
        }
        if (postsRes?.ok) {
          const data = await postsRes.json().catch(() => [])
          update.scheduled = Array.isArray(data) ? data.length : 0
        }
        if (billingRes?.ok) {
          const billing = await billingRes.json().catch(() => ({}))
          update.credits = Number(billing.tokenBalance ?? billing.balance ?? billing.credits ?? 0)
        }
        if (plansRes?.ok) {
          const data = await plansRes.json().catch(() => [])
          update.plans = Array.isArray(data) ? data.length : (data?.items?.length ?? 0)
        }
        if (accountsRes?.ok) {
          const data = await accountsRes.json().catch(() => [])
          update.socials = Array.isArray(data) ? data.length : 0
        }

        setStats((prev) => ({ ...prev, ...update }))
      } catch { /* ignore */ }
    }
    void fetchData()
  }, [currentWorkspace])

  if (status === 'loading') return <LoadingDashboard />
  if (!session) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Redirecting...</div>

  const displayName = session.user?.name?.split(' ')[0] || session.user?.email?.split('@')[0] || 'creator'

  const phases: PhaseCardData[] = [
    {
      phase: 1,
      label: 'Create',
      description: 'Set up AI characters with consistent identity, LoRA models, and reference images.',
      icon: Users2,
      stat: stats.creators,
      statLabel: 'Creators',
      href: '/creators',
      cta: 'Manage creators',
      pages: [
        { label: 'Creators', href: '/creators' },
        { label: 'Templates', href: '/templates' },
      ],
    },
    {
      phase: 2,
      label: 'Generate',
      description: 'Use the Studio to generate images, videos, and campaign posts with AI.',
      icon: Video,
      stat: stats.credits,
      statLabel: 'Credits available',
      href: '/studio',
      cta: 'Open Studio',
      pages: [
        { label: 'Studio', href: '/studio' },
        { label: 'Edit', href: '/edit' },
        { label: 'Design', href: '/design' },
      ],
    },
    {
      phase: 3,
      label: 'Content',
      description: 'Browse generated assets, manage the vault, and run batch production.',
      icon: Images,
      stat: stats.assets || '-',
      statLabel: 'Assets',
      href: '/gallery',
      cta: 'View Gallery',
      pages: [
        { label: 'Gallery', href: '/gallery' },
        { label: 'Vault', href: '/vault' },
        { label: 'Production', href: '/production' },
      ],
    },
    {
      phase: 4,
      label: 'Automate',
      description: 'Run the AI Factory pipeline or plan content strategy with the Planner.',
      icon: Sparkles,
      stat: stats.plans,
      statLabel: 'Content plans',
      href: '/automation/factory',
      cta: 'Launch Factory',
      pages: [
        { label: 'Factory', href: '/automation/factory' },
        { label: 'Planner', href: '/planner' },
      ],
    },
    {
      phase: 5,
      label: 'Publish',
      description: 'Schedule content on the calendar, connect social platforms, and manage inbox.',
      icon: Share2,
      stat: stats.scheduled,
      statLabel: 'Scheduled',
      href: '/calendar',
      cta: 'View Calendar',
      pages: [
        { label: 'Calendar', href: '/calendar' },
        { label: 'Socials', href: '/socials' },
        { label: 'Inbox', href: '/inbox' },
      ],
    },
    {
      phase: 6,
      label: 'Grow',
      description: 'Track analytics, set up monetization offers, and manage agency operations.',
      icon: BarChart3,
      stat: stats.socials,
      statLabel: 'Connected accounts',
      href: '/analytics',
      cta: 'View Analytics',
      pages: [
        { label: 'Analytics', href: '/analytics' },
        { label: 'Monetization', href: '/monetization' },
        { label: 'Agency', href: '/agency' },
      ],
    },
  ]

  const valueCards = [
    {
      icon: Bot,
      title: 'AI creator workflow',
      description: 'Build consistent digital talent, lock in references, and route generation work through Studio without hunting across the app.',
    },
    {
      icon: Factory,
      title: 'Production at scale',
      description: 'Move from a one-off render to repeatable campaigns with planning, automation, and asset management in the same operating layer.',
    },
    {
      icon: CheckCircle2,
      title: 'Premium product framing',
      description: 'This dashboard now explains the offer clearly for teammates, clients, and future subscribers instead of looking like a blank internal tool.',
    },
  ]

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Mission Control"
        title={`Welcome back, ${displayName}`}
        description="Run a premium AI creator business from one workspace: design talent, generate polished visuals, automate production, and turn content operations into a growth engine."
        actions={
          <>
            <Button asChild size="lg" className="gap-2">
              <Link href="/automation/factory">
                <Sparkles className="h-4 w-4" />
                AI Factory
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/studio">
                <Video className="h-4 w-4" />
                Open Studio
              </Link>
            </Button>
          </>
        }
        metrics={[
          { label: 'Workspace', value: currentWorkspace?.name || 'Select one' },
          { label: 'Creators', value: stats.creators },
          { label: 'Scheduled', value: stats.scheduled },
        ]}
        media={
          <SpotlightPanel
            workspaceName={currentWorkspace?.name || 'Your workspace'}
            creatorCount={stats.creators}
            scheduledCount={stats.scheduled}
          />
        }
      />

      <SaaSOverviewGrid />

      <div className="grid gap-4 lg:grid-cols-3">
        {valueCards.map((card) => (
          <ValueCard key={card.title} icon={card.icon} title={card.title} description={card.description} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {phases.map((phase) => (
          <PhaseCard key={phase.phase} data={phase} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <GettingStartedChecklist />

        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Quick actions</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Use these to demo the product fast, onboard a new workspace, or push the next campaign live.
                </p>
              </div>
              <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                High intent
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button asChild variant="outline" size="sm" className="justify-start gap-2">
                <Link href="/creators/create"><Users2 className="h-3.5 w-3.5" />New creator</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start gap-2">
                <Link href="/studio"><Video className="h-3.5 w-3.5" />Generate content</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start gap-2">
                <Link href="/planner"><Calendar className="h-3.5 w-3.5" />Plan content</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start gap-2">
                <Link href="/socials"><Share2 className="h-3.5 w-3.5" />Connect socials</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start gap-2">
                <Link href="/settings/billing"><DollarSign className="h-3.5 w-3.5" />Billing</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="justify-start gap-2">
                <Link href="/analytics"><BarChart3 className="h-3.5 w-3.5" />Analytics</Link>
              </Button>
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <Building className="h-3.5 w-3.5" />
                Revenue narrative
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Lead with creators and generation in demos. Then show automation, scheduling, analytics, and billing to position the platform as a full-stack creator business system.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
