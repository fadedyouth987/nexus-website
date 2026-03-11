'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import apiFetch from '@/lib/core/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Loader2,
  ArrowLeft,
  Coins,
  Image as ImageIcon,
  Film,
  Wand2,
  Zap,
  Send,
  Cpu,
  Layers,
} from 'lucide-react'

type CatalogItem = {
  operation: string
  category: string
  label: string
  tokensPerUnit: number
  unitLabel: string
  description: string
}

type TierAllowance = {
  label: string
  monthlyTokens: number
  monthlyPrice: number
  annualPrice: number
  storageGb: number
}

type TokenCostsPayload = {
  catalog: CatalogItem[]
  categories: string[]
  tierTokenAllowances: Record<string, TierAllowance>
  topup: { tokensPerPack: number; usdPerPack: number }
}

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  generation: { label: 'Generation', icon: <ImageIcon className="h-4 w-4" />, color: 'text-violet-400' },
  edit:       { label: 'Editing',    icon: <Wand2 className="h-4 w-4" />,     color: 'text-sky-400' },
  automation: { label: 'Automation', icon: <Zap className="h-4 w-4" />,       color: 'text-amber-400' },
  publishing: { label: 'Publishing', icon: <Send className="h-4 w-4" />,      color: 'text-emerald-400' },
  model:      { label: 'GPU / Model',icon: <Cpu className="h-4 w-4" />,       color: 'text-rose-400' },
}

export default function TokenCostsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<TokenCostsPayload | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }
    if (status !== 'authenticated') return

    let cancelled = false
    async function load() {
      try {
        const res = await apiFetch('/billing/token-costs')
        if (!res.ok) throw new Error('Failed to load token costs')
        const json = (await res.json()) as TokenCostsPayload
        if (!cancelled) setData(json)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Request failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [status, router])

  const grouped = useMemo(() => {
    if (!data) return {}
    const map: Record<string, CatalogItem[]> = {}
    for (const item of data.catalog) {
      ;(map[item.category] ??= []).push(item)
    }
    return map
  }, [data])

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Token Costs"
          description="See how many tokens each operation uses."
          breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }, { label: 'Billing', href: '/settings/billing' }, { label: 'Token Costs' }]}
        />
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-4 text-sm text-destructive">{error || 'Unable to load token cost data.'}</CardContent>
        </Card>
      </div>
    )
  }

  const tierEntries = Object.entries(data.tierTokenAllowances)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Token Costs"
        description="Complete breakdown of token costs per operation across all categories."
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }, { label: 'Billing', href: '/settings/billing' }, { label: 'Token Costs' }]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/billing" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to billing
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tierEntries.map(([id, tier]) => (
          <Card key={id} className="relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary/80 to-primary/30" />
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-foreground">{tier.label}</CardTitle>
              <CardDescription className="text-xs">${tier.monthlyPrice}/mo &middot; ${tier.annualPrice}/yr</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-foreground">{tier.monthlyTokens.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">tokens / month</p>
              <p className="mt-1 text-xs text-muted-foreground">{tier.storageGb >= 1000 ? `${tier.storageGb / 1000} TB` : `${tier.storageGb} GB`} storage</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(data.categories ?? Object.keys(grouped)).map((cat) => {
        const items = grouped[cat]
        if (!items?.length) return null
        const meta = CATEGORY_META[cat] ?? { label: cat, icon: <Layers className="h-4 w-4" />, color: 'text-muted-foreground' }

        return (
          <Card key={cat}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 text-base ${meta.color}`}>
                {meta.icon}
                {meta.label}
              </CardTitle>
              <CardDescription>{items.length} operation{items.length > 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[540px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 font-medium text-muted-foreground">Operation</th>
                      <th className="py-2 pr-4 text-right font-medium text-muted-foreground">Cost</th>
                      <th className="py-2 pr-4 font-medium text-muted-foreground">Unit</th>
                      <th className="py-2 font-medium text-muted-foreground">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.operation} className="border-b border-border/40">
                        <td className="py-2.5 pr-4 font-medium text-foreground">{item.label}</td>
                        <td className="py-2.5 pr-4 text-right">
                          <Badge variant={item.tokensPerUnit === 0 ? 'secondary' : 'default'} className="tabular-nums">
                            <Coins className="mr-1 h-3 w-3" />
                            {item.tokensPerUnit}
                          </Badge>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">{item.unitLabel}</td>
                        <td className="py-2.5 text-xs text-muted-foreground">{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      })}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-foreground">
            <Coins className="h-4 w-4" />
            Token top-up
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>Need more tokens? Purchase top-up packs at any time.</p>
          <p className="mt-2 font-medium text-foreground">
            {data.topup.tokensPerPack} tokens for ${data.topup.usdPerPack}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Equivalent to {Math.floor(data.topup.tokensPerPack / 8)} image generations or {Math.floor(data.topup.tokensPerPack / 45)} video clips.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/checkout">Purchase tokens</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-foreground">How tokens work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>Tokens are deducted at the start of each operation. If an operation fails before processing, the tokens are refunded automatically.</p>
          <p>Your monthly allowance resets on each billing cycle. Unused tokens do not roll over. Top-up tokens are added immediately and never expire as long as your subscription is active.</p>
          <p>GPU model jobs are billed based on actual runtime (rounded up). The rate is {data.catalog.find((c) => c.operation === 'model_validation')?.tokensPerUnit ?? 242} tokens per GPU-hour.</p>
        </CardContent>
      </Card>
    </div>
  )
}
