'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import apiFetch from '@/lib/core/api'
import { TIER_PLANS } from '@/lib/billing/tierPlans'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { Loader2, CreditCard, Coins, ArrowLeft, ExternalLink, CheckCircle, Cpu, HardDrive, ListTree } from 'lucide-react'
import { cn } from '@/lib/core/utils'

type OrgResponse = {
  id: string
  name: string
  role: 'owner' | 'admin' | 'editor' | 'viewer'
}

type BillingMeResponse = {
  balance: number
  tokenBalance?: number
  monthlyTokenAllowance?: number
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  plan: string
  planStatus: string
  planRenewsAt: string | null
}

const PLAN_LABELS: Record<string, string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  SCALE: 'Scale',
  ENTERPRISE: 'Enterprise',
  VAULT: 'Vault',
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  PAST_DUE: 'Past due',
  CANCELED: 'Canceled',
}

const EDIT_TIER_TRACKS: Array<{
  plan: string
  title: string
  audience: string
  batchLimit: number
  summary: string
}> = [
  { plan: 'STARTER', title: 'Tier 1', audience: 'Solo influencer', batchLimit: 2, summary: 'Daily single-creator edits, fast turnaround, focused output quality.' },
  { plan: 'PRO', title: 'Tier 2', audience: 'Growth operator', batchLimit: 8, summary: 'Batch-ready daily workflow for multiple content variants and channels.' },
  { plan: 'ENTERPRISE', title: 'Tier 3', audience: 'Scaling agency', batchLimit: 24, summary: 'High-throughput editing operations with large batch dispatch.' },
]

function normalizeTierTrack(value: unknown): string {
  const plan = typeof value === 'string' ? value.trim().toUpperCase() : 'STARTER'
  return plan === 'VAULT' ? 'PRO' : plan
}

const TIER_CATALOG = [
  {
    name: TIER_PLANS.tier1.title,
    monthly: `$${TIER_PLANS.tier1.monthlyPrice}`,
    annual: `$${TIER_PLANS.tier1.annualPrice}`,
    storage: `${TIER_PLANS.tier1.storageGb} GB`,
    includes: 'Starter automation stack, solo workflows',
  },
  {
    name: TIER_PLANS.tier2.title,
    monthly: `$${TIER_PLANS.tier2.monthlyPrice}`,
    annual: `$${TIER_PLANS.tier2.annualPrice}`,
    storage: `${TIER_PLANS.tier2.storageGb} GB`,
    includes: 'Expanded automation, analytics, NSFW gating',
  },
  {
    name: TIER_PLANS.tier3.title,
    monthly: `$${TIER_PLANS.tier3.monthlyPrice}`,
    annual: `$${TIER_PLANS.tier3.annualPrice}`,
    storage: `${TIER_PLANS.tier3.storageGb >= 1000 ? `${TIER_PLANS.tier3.storageGb / 1000} TB` : `${TIER_PLANS.tier3.storageGb} GB`}`,
    includes: 'Full automation suite, team operations',
  },
  {
    name: TIER_PLANS.enterprise.title,
    monthly: `$${TIER_PLANS.enterprise.monthlyPrice}`,
    annual: `$${TIER_PLANS.enterprise.annualPrice}`,
    storage: `${TIER_PLANS.enterprise.storageGb >= 1000 ? `${TIER_PLANS.enterprise.storageGb / 1000} TB+` : `${TIER_PLANS.enterprise.storageGb} GB+`}`,
    includes: 'All Tier 3 features plus enterprise controls and SLA',
  },
]

function BillingSettingsPageContent() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<OrgResponse | null>(null)
  const [billing, setBilling] = useState<BillingMeResponse | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState<string | null>(null)
  const [successDismissed, setSuccessDismissed] = useState(false)
  const successParam = searchParams.get('success') === '1' && !successDismissed

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }

    if (status === 'authenticated') {
      void loadData()
    }
  }, [status, router])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [orgRes, billingRes] = await Promise.all([apiFetch('/org'), apiFetch('/billing/me')])

      if (orgRes.ok) {
        setOrg((await orgRes.json()) as OrgResponse)
      } else {
        setOrg(null)
      }

      if (billingRes.ok) {
        setBilling((await billingRes.json()) as BillingMeResponse)
      } else {
        setBilling(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing settings')
    } finally {
      setLoading(false)
    }
  }

  const openManageBilling = async () => {
    if (!billing?.stripeCustomerId) {
      setPortalError('Complete a checkout first to link your billing account.')
      return
    }

    setPortalLoading(true)
    setPortalError(null)

    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/settings/billing`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPortalError((data.detail as string) || 'Failed to open billing portal')
        return
      }
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setPortalError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setPortalLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Billing"
          description="Manage your plan, credits, and payment method."
          breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }, { label: 'Billing' }]}
        />
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-4 text-sm text-destructive">
            {error || 'Organization context missing. Connect an organization to manage billing.'}
          </CardContent>
        </Card>
      </div>
    )
  }

  const canAccessBilling = org.role === 'owner' || org.role === 'admin'

  if (!canAccessBilling) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Billing"
          description="Manage your plan, credits, and payment method."
          breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }, { label: 'Billing' }]}
        />
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-foreground">Access restricted</CardTitle>
            <CardDescription>Billing settings require an owner or admin role.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Your current role is{' '}
            <span className="font-medium capitalize text-foreground">{org.role}</span>. Only owners and admins can
            view or change billing.
          </CardContent>
        </Card>
      </div>
    )
  }

  const planKey = billing?.plan ? String(billing.plan).toUpperCase() : ''
  const planLabel = PLAN_LABELS[planKey] || (billing?.plan ? String(billing.plan).replace(/_/g, ' ') : '-')
  const planStatusKey = billing?.planStatus ? String(billing.planStatus).toUpperCase() : ''
  const planStatusLabel =
    PLAN_STATUS_LABELS[planStatusKey] ||
    (billing?.planStatus ? String(billing.planStatus).replace(/_/g, ' ') : 'Unknown')
  const renewsAt = billing?.planRenewsAt ? new Date(billing.planRenewsAt).toLocaleDateString() : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Manage your plan, credits, and payment method."
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }, { label: 'Billing' }]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        }
      />

      {successParam && (
        <Card className="border-green-500/30 bg-green-500/10">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>Subscription updated successfully.</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSuccessDismissed(true)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium text-foreground">Current plan</CardTitle>
            <Badge variant="secondary" className="font-medium">
              {planLabel}
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your active subscription tier. Upgrade or change plan from the pricing or checkout page.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Status: <span className="font-medium text-foreground">{planStatusLabel}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Renews: <span className="font-medium text-foreground">{renewsAt || 'Not scheduled'}</span>
            </p>
            <Button asChild variant="outline" size="sm" className="mt-4">
              <Link href="/pricing" className="flex items-center gap-2">
                View plans
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium text-foreground">Tokens</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums text-foreground">
              {Math.floor(billing?.tokenBalance ?? billing?.balance ?? 0)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Generation tokens for image and video workloads</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Monthly allowance: {Math.floor(billing?.monthlyTokenAllowance ?? 0).toLocaleString()} tokens
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/checkout">Manage subscription</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/settings/billing/token-costs" className="flex items-center gap-1.5">
                  <ListTree className="h-3.5 w-3.5" />
                  View token costs
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Edit & generation tiers</CardTitle>
          <CardDescription>
            Plan-based batch limits for the Edit and Studio workflows. Your current plan determines how many assets you can process per batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            {EDIT_TIER_TRACKS.map((tier) => {
              const isActive = tier.plan === normalizeTierTrack(billing?.plan)
              return (
                <div
                  key={tier.plan}
                  className={cn(
                    'rounded-lg border bg-card px-4 py-3',
                    isActive ? 'border-primary/50 ring-1 ring-primary/30' : 'border-border/70'
                  )}
                >
                  <p className="text-xs text-muted-foreground">{tier.title}</p>
                  <p className="text-sm font-semibold text-foreground">{tier.audience}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{tier.summary}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Batch limit: <span className="font-medium text-foreground">{tier.batchLimit}</span>
                  </p>
                  {isActive && billing && (
                    <p className="mt-1 text-[11px] text-primary">
                      Active plan: {billing.plan} ({planStatusLabel}) · {Math.floor(billing.tokenBalance ?? billing.balance ?? 0)} tokens
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">Tier pricing model</CardTitle>
          <CardDescription>
            Monthly and annual pricing for Tier 1-3 and Enterprise, with higher tiers unlocking broader capabilities.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 font-medium text-muted-foreground">Tier</th>
                  <th className="py-2 pr-4 font-medium text-muted-foreground">Monthly</th>
                  <th className="py-2 pr-4 font-medium text-muted-foreground">Annual</th>
                  <th className="py-2 pr-4 font-medium text-muted-foreground">Storage</th>
                  <th className="py-2 pr-4 font-medium text-muted-foreground">Unlocks</th>
                </tr>
              </thead>
              <tbody>
                {TIER_CATALOG.map((tier) => (
                  <tr key={tier.name} className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium text-foreground">{tier.name}</td>
                    <td className="py-2 pr-4 text-foreground">{tier.monthly}</td>
                    <td className="py-2 pr-4 text-foreground">{tier.annual}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{tier.storage}</td>
                    <td className="py-2 pr-4 text-muted-foreground">{tier.includes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 text-foreground">
                <HardDrive className="h-3.5 w-3.5" />
                Storage planning
              </p>
              <p className="mt-1">Tier pricing includes storage assumptions per active user so growth does not surprise billing operations.</p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-1.5 text-foreground">
                <Cpu className="h-3.5 w-3.5" />
                GPU scaling path
              </p>
              <p className="mt-1">Enterprise includes full Tier 3 access and a runway to dedicated A100 capacity and RunPod enterprise-level infrastructure.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Coins className="h-4 w-4" />
              Token cost reference
            </CardTitle>
            <CardDescription className="mt-1">
              See exactly how many tokens each operation uses across generation, editing, automation, and publishing.
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/billing/token-costs" className="flex items-center gap-2">
              <ListTree className="h-3.5 w-3.5" />
              Full breakdown
            </Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <CreditCard className="h-4 w-4" />
            Manage subscription
          </CardTitle>
          <CardDescription>
            Open the Stripe Customer Portal to update payment method, view invoices, or cancel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/pricing">View pricing</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/checkout">Subscribe / Checkout</Link>
          </Button>
          <Button variant="secondary" size="sm" onClick={openManageBilling} disabled={portalLoading}>
            {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Manage billing (Stripe)'}
          </Button>
        </CardContent>
        {portalError && (
          <CardContent className="pt-0">
            <p className="text-sm text-destructive">{portalError}</p>
          </CardContent>
        )}
      </Card>
    </div>
  )
}

export default function BillingSettingsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[300px] items-center justify-center text-sm text-muted-foreground">Loading billing...</div>}>
      <BillingSettingsPageContent />
    </Suspense>
  )
}
