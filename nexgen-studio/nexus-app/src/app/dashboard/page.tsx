'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  BarChart3,
  Building,
  Calendar,
  DollarSign,
  Factory,
  Images,
  Loader2,
  Pencil,
  Share2,
  Sparkles,
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

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Mission Control"
        title={`Welcome back, ${displayName}`}
        description="Your 6-phase workflow: Create characters, generate content, manage assets, automate pipelines, publish to platforms, and grow your audience."
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
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {phases.map((phase) => (
          <PhaseCard key={phase.phase} data={phase} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <GettingStartedChecklist />

        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground">Quick actions</h3>
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
