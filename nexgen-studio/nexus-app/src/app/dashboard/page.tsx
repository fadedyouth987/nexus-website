'use client'

import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  Calendar,
  FolderOpen,
  ImageIcon,
  Loader2,
  PlusCircle,
  Sparkles,
  Upload,
  Users,
  Zap,
} from 'lucide-react'
import apiFetch from '@/lib/core/api'
import { isPortfolioV2ClientEnabled } from '@/lib/core/featureFlags'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { VaultModeToggle } from '@/components/vault/VaultModeToggle'
import { useWorkspace } from '@/context/WorkspaceContext'
import { AppHero } from '@/components/layout/AppHero'

type Influencer = {
  id: string
  name: string
}

type WorkspaceV2 = {
  id: string
  org_id: string
  name: string
  client_visible: boolean
  created_at: string
  role: string
}

type CreatorV2Response = {
  items: Array<{
    id: string
    name: string
    status: string
  }>
  meta: {
    org_id: string
    workspace_id: string
    workspace_name: string
    role: string
  }
}

type MetricCardProps = {
  title: string
  value: string | number
  icon: ComponentType<{ className?: string }>
  href?: string
  eyebrow?: string
}

function DashboardMetricCard({ title, value, icon: Icon, href, eyebrow }: MetricCardProps) {
  const content = (
    <div className="app-shell-panel-muted h-full p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {eyebrow || 'Metric'}
          </div>
          <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
          <div className="mt-1 text-sm text-muted-foreground">{title}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )

  return href ? (
    <Link href={href} className="block transition-transform duration-200 hover:-translate-y-0.5">
      {content}
    </Link>
  ) : (
    content
  )
}

function LoadingDashboard() {
  return (
    <div className="space-y-[var(--section-gap)]">
      <div className="app-hero-shell space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-14 w-96" />
        <Skeleton className="h-4 w-[34rem]" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-[22px]" />
          <Skeleton className="h-24 rounded-[22px]" />
          <Skeleton className="h-24 rounded-[22px]" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <Skeleton key={item} className="h-36 rounded-[24px]" />
        ))}
      </div>
    </div>
  )
}

function LegacyDashboardPage() {
  const { data: session, status } = useSession()
  const { currentWorkspace } = useWorkspace()
  const router = useRouter()
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [stats, setStats] = useState({
    creators: 0,
    posts: 0,
    audience: 0,
    scheduled: 0,
    credits: 0,
    automation: 0,
  })

  useEffect(() => {
    if (session?.vault_mode === 'nsfw') {
      router.push('/dashboard/vault')
    }
  }, [session, router])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
    }
  }, [status, router])

  useEffect(() => {
    if (!currentWorkspace) return

    const fetchData = async () => {
      try {
        const influencersRes = await apiFetch(`/workspaces/${currentWorkspace.id}/influencers`)
        if (!influencersRes.ok) throw new Error('Failed to fetch influencers')

        const influencerData = await influencersRes.json()
        setInfluencers(influencerData)
        setStats((prev) => ({ ...prev, creators: influencerData.length }))

        const postsRes = await apiFetch(`/workspaces/${currentWorkspace.id}/posts?status=scheduled`)
        if (postsRes.ok) {
          const postData = await postsRes.json()
          const scheduledCount = Array.isArray(postData) ? postData.length : 0
          setStats((prev) => ({ ...prev, posts: scheduledCount, scheduled: scheduledCount }))
        }

        if (influencerData.length > 0) {
          const audiencePromises = influencerData.map((influencer: Influencer) =>
            apiFetch(`/influencers/${influencer.id}/social_accounts`).then((response) =>
              response.ok ? response.json() : []
            )
          )
          const accountsByInfluencer = await Promise.all(audiencePromises)
          const totalAudience = accountsByInfluencer
            .flat()
            .reduce((sum, account) => sum + (account.follower_count || 0), 0)
          setStats((prev) => ({ ...prev, audience: totalAudience }))
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      }
    }

    void fetchData()
  }, [currentWorkspace])

  if (status === 'loading') return <LoadingDashboard />

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    )
  }

  const user = session.user
  const displayName = user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'creator'

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Dashboard flow"
        title={`Welcome back, ${displayName}`}
        description="Your creators, content, schedules, and performance live in one consistent operating system now. Launch faster, keep the brand steady, and move from studio to automation without losing context."
        actions={
          <>
            <Button asChild size="lg" className="gap-2">
              <Link href="/creators/create">
                <PlusCircle className="h-4 w-4" />
                Create creator
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/studio">
                <Sparkles className="h-4 w-4" />
                Open Studio
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/automation">
                <Zap className="h-4 w-4" />
                Automation
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="gap-2">
              <Link href="/assets">
                <Upload className="h-4 w-4" />
                Upload assets
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
          <Image
            src="/app/dashboard-hero.svg"
            alt="Dashboard overview artwork"
            width={1400}
            height={980}
            priority
            className="h-auto w-full rounded-[24px]"
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardMetricCard title="Creators in the workspace" value={stats.creators} icon={Users} href="/creators" eyebrow="Roster" />
        <DashboardMetricCard title="Published or queued content" value={stats.posts} icon={ImageIcon} href="/gallery" eyebrow="Content" />
        <DashboardMetricCard title="Scheduled posts ready to ship" value={stats.scheduled} icon={Calendar} href="/calendar" eyebrow="Schedule" />
        <DashboardMetricCard title="Audience reachable now" value={stats.audience.toLocaleString()} icon={BarChart3} href="/intelligence" eyebrow="Reach" />
        <DashboardMetricCard title="Credits available" value={stats.credits || '-'} icon={FolderOpen} href="/settings/billing" eyebrow="Spend" />
        <DashboardMetricCard title="Automation flows" value={stats.automation} icon={Zap} href="/automation" eyebrow="Automation" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <div className="app-shell-panel-muted p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Getting started</div>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">Move from creator setup to launch</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Create an influencer in Studio, build an automation flow, then route finished work into Gallery and calendar. Vault is still available when you need gated flows.
              </p>
            </div>
            <VaultModeToggle />
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-xl">Recent creator activity</CardTitle>
            <CardDescription>The latest identities you can extend, schedule, and monetize.</CardDescription>
          </CardHeader>
          <CardContent>
            {influencers.length > 0 ? (
              <ul className="space-y-3">
                {influencers.slice(0, 5).map((influencer) => (
                  <li key={influencer.id} className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                    <Link href={`/influencers/${influencer.id}`} className="text-sm font-medium text-foreground hover:text-primary">
                      {influencer.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No creators yet. Create your first influencer to get started.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function PortfolioV2Page() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceV2[]>([])
  const [creatorData, setCreatorData] = useState<CreatorV2Response | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }

    if (status === 'authenticated') {
      void fetchPortfolio()
    }
  }, [status, router])

  const fetchPortfolio = async () => {
    setLoading(true)
    setError(null)

    try {
      const workspaceResponse = await apiFetch('/workspaces')
      if (!workspaceResponse.ok) {
        const payload = await workspaceResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load workspaces')
      }

      const workspaceRows = (await workspaceResponse.json()) as WorkspaceV2[]
      setWorkspaces(workspaceRows)

      if (workspaceRows.length > 0) {
        const creatorResponse = await apiFetch(`/creators?workspace_id=${workspaceRows[0].id}`)
        if (!creatorResponse.ok) {
          const payload = await creatorResponse.json().catch(() => ({}))
          throw new Error(payload.detail || 'Failed to load creators')
        }

        const creatorsPayload = (await creatorResponse.json()) as CreatorV2Response
        setCreatorData(creatorsPayload)
      } else {
        setCreatorData(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) return <LoadingDashboard />

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    )
  }

  const activeWorkspace = creatorData?.meta?.workspace_name || workspaces[0]?.name || 'No workspace'

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Portfolio v2"
        title="Organization-first creator overview"
        description="This view is already backed by the new tenancy-aware APIs. The shell and surface system now match the rest of the product while preserving the existing rollout path."
        actions={
          <Button variant="outline" onClick={() => signOut({ redirect: true, callbackUrl: '/auth' })}>
            Sign out
          </Button>
        }
        metrics={[
          { label: 'Workspaces', value: workspaces.length },
          { label: 'Active workspace', value: activeWorkspace },
          { label: 'Creators', value: creatorData?.items.length || 0 },
        ]}
        media={
          <Image
            src="/app/dashboard-hero.svg"
            alt="Portfolio dashboard artwork"
            width={1400}
            height={980}
            className="h-auto w-full rounded-[24px]"
          />
        }
      />

      {error ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Workspace directory</CardTitle>
            <CardDescription>First v2 list endpoint now backing the portfolio layer.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workspaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workspaces available for this account.</p>
            ) : (
              workspaces.map((workspace) => (
                <div key={workspace.id} className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                  <div className="font-medium text-foreground">{workspace.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Role: {workspace.role} | Client visible: {workspace.client_visible ? 'Yes' : 'No'}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next cutovers</CardTitle>
            <CardDescription>Safe strangler path from here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">Add `/api/content` backed by `content_v2`.</div>
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">Add `/api/portfolio` aggregate metrics instead of client fan-out.</div>
            <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">Move Calendar onto `schedules_v2`.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return isPortfolioV2ClientEnabled() ? <PortfolioV2Page /> : <LegacyDashboardPage />
}
