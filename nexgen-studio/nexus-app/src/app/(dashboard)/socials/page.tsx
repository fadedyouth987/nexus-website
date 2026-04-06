'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { ArrowLeft, CheckCircle2, ExternalLink, Link2, Loader2, Radio, Share2, Unplug, Webhook, XCircle, Zap } from 'lucide-react'
import { PLATFORM_POLICY } from '@/lib/social/platformPolicy'
import { PLATFORM_LOGOS } from '@/lib/social/platformLogos'
import { cn } from '@/lib/core/utils'

type Account = {
  id: string
  provider: string
  accountName: string
  accountId: string
  tokenExpiresAt: string | null
  createdAt: string
}

type PublishJob = {
  id: string
  provider: string
  post_content: string
  status: string
  scheduled_for: string | null
  published_at: string | null
  error_message: string | null
  created_at: string
}

const SFW_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'twitter', 'youtube', 'linkedin', 'pinterest', 'reddit', 'threads', 'snapchat'] as const
const NSFW_PLATFORMS = ['onlyfans', 'fansly'] as const
const PLATFORM_ORDER = [...SFW_PLATFORMS, ...NSFW_PLATFORMS] as const

const INTEGRATION_META = {
  live: {
    label: 'Live',
    actionLabel: 'Connect',
    badgeClass: 'border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  stub: {
    label: 'Stub',
    actionLabel: 'Stub in dev',
    badgeClass: 'border-amber-300/60 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  planned: {
    label: 'Planned',
    actionLabel: 'Coming soon',
    badgeClass: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  },
} as const

function yesNo(value: boolean) {
  return value ? 'Yes' : 'No'
}

function getLinkMethod(integration: keyof typeof INTEGRATION_META) {
  if (integration === 'live') return 'OAuth API'
  if (integration === 'stub') return 'Stub / API next'
  return 'Planned API or webhook'
}

function StatCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-muted/30 p-4 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  )
}

export default function SocialsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SocialsContent />
    </Suspense>
  )
}

function SocialsContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [origin, setOrigin] = useState('')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [jobs, setJobs] = useState<PublishJob[]>([])
  const [loading, setLoading] = useState(true)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [ageVerified, setAgeVerified] = useState(false)

  useEffect(() => {
    fetch('/api/age-gate', { credentials: 'include' })
      .then((response) => response.json())
      .then((data: { verified?: boolean }) => setAgeVerified(data.verified === true))
      .catch(() => {})
  }, [])

  const platformIds = useMemo(() => {
    const seen = new Set<string>()
    const merged: string[] = []
    for (const id of PLATFORM_ORDER) {
      if (!seen.has(id) && PLATFORM_POLICY[id]) { merged.push(id); seen.add(id) }
    }
    for (const id of Object.keys(PLATFORM_POLICY)) {
      if (!seen.has(id)) { merged.push(id); seen.add(id) }
    }
    return merged
  }, [])

  const accountsByProvider = useMemo(() => {
    const mapped: Record<string, Account[]> = {}
    for (const account of accounts) {
      const key = String(account.provider || '').toLowerCase()
      if (!mapped[key]) mapped[key] = []
      mapped[key].push(account)
    }
    return mapped
  }, [accounts])

  const readiness = useMemo(() => {
    const queued = jobs.filter((job) => ['queued', 'pending', 'scheduled'].includes(job.status)).length
    const failed = jobs.filter((job) => job.status === 'failed').length
    const liveConnected = accounts.filter(
      (account) => PLATFORM_POLICY[String(account.provider).toLowerCase()]?.integration === 'live'
    ).length
    if (accounts.length === 0) {
      return { title: 'Not ready', detail: 'Connect at least one live platform to start automated publishing.', className: 'border-destructive/40 bg-destructive/10 text-destructive', queued, failed, liveConnected }
    }
    if (queued === 0) {
      return { title: 'Connection ready', detail: 'Accounts are connected. Queue posts from Planner to start automation.', className: 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300', queued, failed, liveConnected }
    }
    return { title: 'Automation ready', detail: 'Connected accounts and scheduled jobs are in place.', className: 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', queued, failed, liveConnected }
  }, [accounts, jobs])

  useEffect(() => { if (typeof window !== 'undefined') setOrigin(window.location.origin) }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth'); return }
    if (status === 'authenticated') {
      const connected = searchParams.get('connected')
      const error = searchParams.get('error')
      if (connected) setMessage({ type: 'success', text: `Connected ${connected}.` })
      if (error) setMessage({ type: 'error', text: decodeURIComponent(error) })
      void load()
    }
  }, [status, router, searchParams])

  const load = async () => {
    setLoading(true)
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : ''
      const [accRes, jobsRes] = await Promise.all([
        fetch(`${base}/api/social/accounts`, { credentials: 'include' }),
        fetch(`${base}/api/social/publish/history`, { credentials: 'include' }).catch(() => null),
      ])
      if (accRes.ok) {
        const data = await accRes.json()
        const rows = Array.isArray(data) ? data : []
        setAccounts(rows.map((a: Record<string, unknown>) => ({ id: String(a.id || ''), provider: String(a.provider || ''), accountName: String(a.accountName || ''), accountId: String(a.accountId || ''), tokenExpiresAt: (a.tokenExpiresAt as string | null) ?? null, createdAt: String(a.createdAt || '') })))
      }
      if (jobsRes?.ok) {
        const data = await jobsRes.json()
        setJobs(Array.isArray(data.items) ? data.items : [])
      }
    } catch { setMessage({ type: 'error', text: 'Failed to load accounts' }) }
    finally { setLoading(false) }
  }

  const handleConnect = (providerId: string) => {
    const provider = PLATFORM_POLICY[providerId]
    if (!provider) { setMessage({ type: 'error', text: `Unknown provider: ${providerId}` }); return }
    if (provider.integration !== 'live') { setMessage({ type: 'error', text: `${provider.label} is not live yet.` }); return }
    const base = typeof window !== 'undefined' ? window.location.origin : ''
    const redirectUri = `${base}/api/social/callback/${providerId}`
    window.location.href = `${base}/api/social/connect/${providerId}?redirect_uri=${encodeURIComponent(redirectUri)}`
  }

  const handleDisconnect = async (accountId: string) => {
    setDisconnecting(accountId)
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : ''
      const res = await fetch(`${base}/api/social/disconnect/${accountId}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) { setAccounts((prev) => prev.filter((a) => a.id !== accountId)); setMessage({ type: 'success', text: 'Account disconnected.' }) }
      else { const data = await res.json().catch(() => ({})); setMessage({ type: 'error', text: (data.detail as string) || 'Disconnect failed' }) }
    } finally { setDisconnecting(null) }
  }

  if (status === 'loading' || loading) {
    return <div className="flex min-h-[300px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Socials"
        description="Connect social media platforms, track integration status, and manage publish automation."
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Socials' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard"><ArrowLeft className="mr-2 h-4 w-4" />Dashboard</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/planner">Open Planner<ExternalLink className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Platforms" value={platformIds.length} detail="Total platforms tracked" />
        <StatCard label="Live now" value={platformIds.filter((id) => PLATFORM_POLICY[id]?.integration === 'live').length} detail="Connectable via OAuth" />
        <StatCard label="Stubbed" value={platformIds.filter((id) => PLATFORM_POLICY[id]?.integration === 'stub').length} detail="Connector in progress" />
        <StatCard label="Restricted" value={NSFW_PLATFORMS.length} detail="18+ gated flows" />
      </section>

      {message ? (
        <Card className={message.type === 'error' ? 'border-destructive/50 bg-destructive/10' : 'border-green-500/30 bg-green-500/10'}>
          <CardContent className="py-3 text-sm">
            {message.text}
            <button type="button" className="ml-2 underline" onClick={() => setMessage(null)}>Dismiss</button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden border-border/80 xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />How platform linking works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/70 bg-gradient-to-r from-muted/30 to-background px-4 py-3">1. Build campaign strategy in <Link href="/planner" className="font-medium text-foreground underline">Planner</Link>.</div>
            <div className="rounded-2xl border border-border/70 bg-gradient-to-r from-muted/30 to-background px-4 py-3">2. Set content rating. NSFW requires 18+ verification.</div>
            <div className="rounded-2xl border border-border/70 bg-gradient-to-r from-muted/30 to-background px-4 py-3">3. Link live connectors below. Stub/planned platforms stay visible.</div>
            <div className="rounded-2xl border border-border/70 bg-gradient-to-r from-muted/30 to-background px-4 py-3">4. Queue publish jobs, then dispatch through the publishing worker.</div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{accounts.length === 0 ? <XCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}Readiness</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={cn('rounded-lg border px-3 py-2 text-sm', readiness.className)}>
              <p className="font-semibold">{readiness.title}</p>
              <p className="mt-1 text-xs opacity-90">{readiness.detail}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Accounts</div><div className="text-xl font-semibold">{accounts.length}</div></div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Live</div><div className="text-xl font-semibold">{readiness.liveConnected}</div></div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Queued</div><div className="text-xl font-semibold">{readiness.queued}</div></div>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><div className="text-xs text-muted-foreground">Failed</div><div className="text-xl font-semibold">{readiness.failed}</div></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Radio className="h-5 w-5" />Platform matrix</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="border-b border-border bg-muted/30"><tr><th className="px-3 py-3 text-left font-medium">Platform</th><th className="px-3 py-3 text-left font-medium">Integration</th><th className="px-3 py-3 text-left font-medium">Link method</th><th className="px-3 py-3 text-left font-medium">SFW</th><th className="px-3 py-3 text-left font-medium">NSFW</th></tr></thead>
            <tbody>
              {platformIds.map((platformId) => {
                const policy = PLATFORM_POLICY[platformId]
                if (!policy) return null
                const integrationMeta = INTEGRATION_META[policy.integration]
                const logoUrl = PLATFORM_LOGOS[platformId] || PLATFORM_LOGOS.twitter
                return (
                  <tr key={platformId} className="border-b border-border/70 transition-colors hover:bg-muted/20">
                    <td className="px-3 py-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/30"><img src={logoUrl} alt="" className="h-5 w-5 object-contain" /></div><span className="font-medium text-foreground">{policy.label}</span></div></td>
                    <td className="px-3 py-3"><Badge className={cn('text-[10px]', integrationMeta.badgeClass)}>{integrationMeta.label}</Badge></td>
                    <td className="px-3 py-3 text-muted-foreground">{getLinkMethod(policy.integration)}</td>
                    <td className="px-3 py-3">{yesNo(policy.supportsSfw)}</td>
                    <td className="px-3 py-3">{yesNo(policy.supportsNsfw)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80">
        <CardHeader><CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />SFW platforms</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {SFW_PLATFORMS.map((platformId) => {
              const policy = PLATFORM_POLICY[platformId]
              if (!policy) return null
              const integrationMeta = INTEGRATION_META[policy.integration]
              const providerAccounts = accountsByProvider[platformId] || []
              const canConnect = policy.integration === 'live'
              const logoUrl = PLATFORM_LOGOS[platformId] || PLATFORM_LOGOS.twitter
              return (
                <div key={platformId} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/50"><img src={logoUrl} alt="" className="h-7 w-7 object-contain" /></div>
                    <div className="min-w-0 flex-1"><p className="font-semibold">{policy.label}</p><div className="mt-1 flex flex-wrap gap-1.5"><Badge variant="outline" className="text-[10px]">SFW</Badge><Badge className={cn('text-[10px]', integrationMeta.badgeClass)}>{integrationMeta.label}</Badge></div></div>
                  </div>
                  <div className="mt-3"><Button variant={providerAccounts.length > 0 ? 'secondary' : 'default'} size="sm" className="w-full" onClick={() => handleConnect(platformId)} disabled={!canConnect}>{providerAccounts.length > 0 ? <><CheckCircle2 className="mr-2 h-4 w-4" />Connected</> : canConnect ? <><Share2 className="mr-2 h-4 w-4" />Connect {policy.label}</> : integrationMeta.actionLabel}</Button></div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80">
        <CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="h-5 w-5" />NSFW platforms</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {!ageVerified ? (
            <div className="rounded-lg border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">Verify 18+ in <Link href="/settings/verification" className="font-medium underline">Age & NSFW settings</Link> to unlock restricted flows.</div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {NSFW_PLATFORMS.map((platformId) => {
              const policy = PLATFORM_POLICY[platformId]
              if (!policy) return null
              const integrationMeta = INTEGRATION_META[policy.integration]
              const providerAccounts = accountsByProvider[platformId] || []
              const canConnect = policy.integration === 'live' && ageVerified
              const logoUrl = PLATFORM_LOGOS[platformId]
              return (
                <div key={platformId} className="rounded-xl border border-border/70 bg-card p-4 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/50">{logoUrl ? <img src={logoUrl} alt="" className="h-7 w-7 object-contain" /> : <Share2 className="h-6 w-6 text-muted-foreground" />}</div>
                    <div className="min-w-0 flex-1"><p className="font-semibold">{policy.label}</p><div className="mt-1 flex flex-wrap gap-1.5"><Badge variant="outline" className="border-rose-400/50 text-[10px] text-rose-600 dark:text-rose-400">NSFW</Badge><Badge className={cn('text-[10px]', integrationMeta.badgeClass)}>{integrationMeta.label}</Badge></div></div>
                  </div>
                  <div className="mt-3"><Button variant={providerAccounts.length > 0 ? 'secondary' : 'default'} size="sm" className="w-full" onClick={() => (ageVerified ? handleConnect(platformId) : router.push('/settings/verification'))} disabled={policy.integration !== 'live'}>{providerAccounts.length > 0 ? <><CheckCircle2 className="mr-2 h-4 w-4" />Connected</> : !ageVerified ? 'Verify 18+ first' : policy.integration === 'live' ? <>Connect {policy.label}</> : integrationMeta.actionLabel}</Button></div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden border-border/80">
          <CardHeader><CardTitle>Connected accounts</CardTitle><CardDescription>{accounts.length === 0 ? 'No accounts connected yet.' : `${accounts.length} connected account(s).`}</CardDescription></CardHeader>
          <CardContent>
            {accounts.length === 0 ? <p className="text-sm text-muted-foreground">Connect a live platform above.</p> : (
              <ul className="space-y-3">
                {accounts.map((account) => {
                  const providerId = String(account.provider || '').toLowerCase()
                  const canonicalId = providerId === 'x' || providerId === 'x-twitter' ? 'twitter' : providerId
                  const label = PLATFORM_POLICY[providerId]?.label || PLATFORM_POLICY[canonicalId]?.label || account.provider
                  const logoUrl = PLATFORM_LOGOS[providerId] || PLATFORM_LOGOS[canonicalId]
                  return (
                    <li key={account.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                      {logoUrl ? <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background"><img src={logoUrl} alt="" className="h-5 w-5 object-contain" /></div> : null}
                      <div className="min-w-0 flex-1"><p className="truncate font-medium">{account.accountName}</p><p className="truncate text-xs text-muted-foreground">{label}{account.tokenExpiresAt ? ` · Expires ${new Date(account.tokenExpiresAt).toLocaleDateString()}` : ''}</p></div>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDisconnect(account.id)} disabled={disconnecting === account.id}>{disconnecting === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}Disconnect</Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-border/80">
          <CardHeader><CardTitle>API endpoints</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><p className="font-medium">Account APIs</p><p className="mt-1 text-muted-foreground"><code>GET /api/social/accounts</code>, <code>GET /api/social/publish/history</code></p></div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><p className="font-medium">Publish APIs</p><p className="mt-1 text-muted-foreground"><code>POST /api/social/publish</code>, <code>POST /api/social/publish/dispatch-due</code></p></div>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3"><p className="font-medium">Webhook</p><p className="mt-1 text-muted-foreground"><code>{origin ? `${origin}/api/webhooks/{provider}` : '/api/webhooks/{provider}'}</code></p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-border/80">
        <CardHeader><CardTitle>Publish history</CardTitle></CardHeader>
        <CardContent>
          {jobs.length === 0 ? <p className="text-sm text-muted-foreground">No publish jobs yet.</p> : (
            <ul className="space-y-2">
              {jobs.slice(0, 20).map((job) => (
                <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 bg-muted/20 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{job.post_content || '(no caption)'}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="outline">{job.status}</Badge>{job.provider}{new Date(job.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
