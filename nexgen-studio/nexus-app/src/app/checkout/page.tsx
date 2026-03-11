'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Check, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/core/utils'
import { TIER_PLANS, resolveTierPlanId } from '@/lib/billing/tierPlans'

const PAGE_BG = 'min-h-screen bg-background text-foreground'
const CARD_BG = 'bg-card border-border'
const MUTED = 'text-muted-foreground'

const PLANS = [
  { id: 'tier1', name: 'Tier 1', price: TIER_PLANS.tier1.monthlyPrice, influencers: 1, tokens: TIER_PLANS.tier1.monthlyTokens },
  { id: 'tier2', name: 'Tier 2', price: TIER_PLANS.tier2.monthlyPrice, influencers: 5, tokens: TIER_PLANS.tier2.monthlyTokens },
  { id: 'tier3', name: 'Tier 3', price: TIER_PLANS.tier3.monthlyPrice, influencers: 20, tokens: TIER_PLANS.tier3.monthlyTokens },
  { id: 'enterprise', name: 'Enterprise', price: TIER_PLANS.enterprise.monthlyPrice, influencers: 50, tokens: TIER_PLANS.enterprise.monthlyTokens },
] as const

const STEPS = [
  { id: 1, label: 'Plan' },
  { id: 2, label: 'Add-ons' },
  { id: 3, label: 'Billing' },
  { id: 4, label: 'Confirmation' },
] as const

function CheckoutPageContent() {
  const searchParams = useSearchParams()
  const [step, setStep] = useState(1)
  const [planId, setPlanId] = useState<string>('tier2')
  const [addOns, setAddOns] = useState({
    extraInfluencers: 0,
    extraTokens: 0,
    nsfwAddOn: false,
    extraTeamSeats: 0,
  })
  const [billing, setBilling] = useState({
    interval: 'monthly' as 'monthly' | 'yearly',
    cardNumber: '',
    taxId: '',
  })
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  const handlePayWithStripe = async () => {
    setCheckoutError(null)
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          interval: billing.interval,
          addOns,
          successUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/settings/billing?success=1`,
          cancelUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/checkout`,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setCheckoutError((data.detail as string) || 'Failed to start checkout')
        return
      }
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setCheckoutLoading(false)
    }
  }

  useEffect(() => {
    const plan = searchParams.get('plan')
    if (plan) {
      setPlanId(resolveTierPlanId(plan))
    }
  }, [searchParams])

  const plan = PLANS.find((p) => p.id === planId) ?? PLANS[1]
  const addOnTotal =
    addOns.extraInfluencers * 15 +
    Math.round((addOns.extraTokens / 100) * 5) +
    (addOns.nsfwAddOn ? 19 : 0) +
    addOns.extraTeamSeats * 29
  const totalTokens = plan.tokens + addOns.extraTokens + addOns.extraInfluencers * 200
  const subtotal = plan.price + addOnTotal
  const total = billing.interval === 'yearly' ? Math.round(subtotal * 11) : subtotal

  return (
    <div className={PAGE_BG}>
      <header className="border-b border-white/5 px-6 py-4 md:px-20">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/pricing" className="text-sm font-medium text-white/80 hover:text-white">
            Back to pricing
          </Link>
          <Link href="/dashboard" className="text-sm font-medium text-white/80 hover:text-white">
            Back to dashboard
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {STEPS.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold',
                  step >= item.id ? 'bg-indigo-600 text-white' : 'bg-white/10 text-white/60'
                )}
              >
                {step > item.id ? <Check className="h-4 w-4" /> : item.id}
              </span>
              <span className={cn('text-sm', step >= item.id ? 'text-white' : MUTED)}>{item.label}</span>
              {item.id < 4 && <ChevronRight className="h-4 w-4 text-white/30" />}
            </div>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12 md:px-20">
        {step === 1 && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold">Select your plan</h1>
              <p className={cn('mt-1 text-sm', MUTED)}>Tier 1, Tier 2, Tier 3, or Enterprise.</p>
            </div>
            <div className="grid gap-4">
              {PLANS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPlanId(item.id)}
                  className={cn(
                    'flex items-center justify-between rounded-xl border p-6 text-left transition-all',
                    CARD_BG,
                    planId === item.id ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-white/10 hover:border-white/20'
                  )}
                >
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className={cn('mt-1 text-sm', MUTED)}>
                      {item.influencers} influencers • {item.tokens.toLocaleString()} tokens/mo
                    </p>
                  </div>
                  <p className="text-xl font-bold">${item.price}/mo</p>
                </button>
              ))}
            </div>
            <Button className="w-full bg-indigo-600 py-6 hover:bg-indigo-500" onClick={() => setStep(2)}>
              Continue to add-ons
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold">Add-ons</h1>
              <p className={cn('mt-1 text-sm', MUTED)}>Extra influencers, tokens, NSFW, or team seats.</p>
            </div>
            <Card className={cn('border', CARD_BG)}>
              <CardContent className="space-y-6 pt-6">
                <div>
                  <Label className="text-sm">Extra AI Influencers (beyond plan)</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[addOns.extraInfluencers]}
                      onValueChange={(v) => setAddOns((state) => ({ ...state, extraInfluencers: v[0] ?? 0 }))}
                      className="flex-1"
                    />
                    <span className="w-8 text-right font-mono text-sm">{addOns.extraInfluencers}</span>
                  </div>
                  <p className={cn('mt-1 text-xs', MUTED)}>$15/influencer per month</p>
                </div>
                <div>
                  <Label className="text-sm">Extra tokens / month</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <Slider
                      min={0}
                      max={10000}
                      step={100}
                      value={[addOns.extraTokens]}
                      onValueChange={(v) => setAddOns((state) => ({ ...state, extraTokens: v[0] ?? 0 }))}
                      className="flex-1"
                    />
                    <span className="w-14 text-right font-mono text-sm">{addOns.extraTokens}</span>
                  </div>
                  <p className={cn('mt-1 text-xs', MUTED)}>Priced per 100 tokens</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/10 p-4">
                  <div>
                    <p className="font-medium">NSFW add-on</p>
                    <p className={cn('text-xs', MUTED)}>Age verification required</p>
                  </div>
                  <Checkbox checked={addOns.nsfwAddOn} onCheckedChange={(checked) => setAddOns((state) => ({ ...state, nsfwAddOn: !!checked }))} />
                  <span className="text-sm font-medium">+$19/mo</span>
                </div>
                <div>
                  <Label className="text-sm">Extra team seats</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <Slider
                      min={0}
                      max={20}
                      step={1}
                      value={[addOns.extraTeamSeats]}
                      onValueChange={(v) => setAddOns((state) => ({ ...state, extraTeamSeats: v[0] ?? 0 }))}
                      className="flex-1"
                    />
                    <span className="w-8 text-right font-mono text-sm">{addOns.extraTeamSeats}</span>
                  </div>
                  <p className={cn('mt-1 text-xs', MUTED)}>$29/seat per month</p>
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-3">
              <Button variant="outline" className="border-white/20" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button className="flex-1 bg-indigo-600 py-6 hover:bg-indigo-500" onClick={() => setStep(3)}>
                Continue to billing
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold">Billing</h1>
              <p className={cn('mt-1 text-sm', MUTED)}>Monthly or yearly. Stripe handles the actual payment step.</p>
            </div>
            <Card className={cn('border', CARD_BG)}>
              <CardContent className="space-y-6 pt-6">
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setBilling((state) => ({ ...state, interval: 'monthly' }))}
                    className={cn(
                      'flex-1 rounded-lg border py-3 text-sm font-medium',
                      billing.interval === 'monthly' ? 'border-indigo-500 bg-indigo-500/20' : 'border-white/10'
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setBilling((state) => ({ ...state, interval: 'yearly' }))}
                    className={cn(
                      'flex-1 rounded-lg border py-3 text-sm font-medium',
                      billing.interval === 'yearly' ? 'border-indigo-500 bg-indigo-500/20' : 'border-white/10'
                    )}
                  >
                    Yearly (2 months free)
                  </button>
                </div>
                <div>
                  <Label className="text-sm">Card number</Label>
                  <Input
                    placeholder="4242 4242 4242 4242"
                    className={cn('mt-2 border-white/10 bg-white/5', CARD_BG)}
                    value={billing.cardNumber}
                    onChange={(e) => setBilling((state) => ({ ...state, cardNumber: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-sm">Tax ID (optional)</Label>
                  <Input
                    placeholder="VAT / GST number"
                    className={cn('mt-2 border-white/10 bg-white/5', CARD_BG)}
                    value={billing.taxId}
                    onChange={(e) => setBilling((state) => ({ ...state, taxId: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>
            <div className="flex gap-3">
              <Button variant="outline" className="border-white/20" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button className="flex-1 bg-indigo-600 py-6 hover:bg-indigo-500" onClick={() => setStep(4)}>
                Review order
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold">Confirm and pay</h1>
              <p className={cn('mt-1 text-sm', MUTED)}>You will be redirected to Stripe to complete payment.</p>
            </div>
            <Card className={cn('border', CARD_BG)}>
              <CardHeader>
                <CardTitle>Order summary</CardTitle>
                <CardDescription className={MUTED}>Plan and add-ons</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>{plan.name} plan</span>
                  <span>${plan.price}/mo</span>
                </div>
                {addOns.extraInfluencers > 0 && (
                  <div className="flex justify-between">
                    <span>+{addOns.extraInfluencers} influencers</span>
                    <span>${addOns.extraInfluencers * 15}/mo</span>
                  </div>
                )}
                {addOns.extraTokens > 0 && (
                  <div className="flex justify-between">
                    <span>+{addOns.extraTokens} tokens</span>
                    <span>${Math.round((addOns.extraTokens / 100) * 5)}/mo</span>
                  </div>
                )}
                {addOns.nsfwAddOn && (
                  <div className="flex justify-between">
                    <span>NSFW add-on</span>
                    <span>$19/mo</span>
                  </div>
                )}
                {addOns.extraTeamSeats > 0 && (
                  <div className="flex justify-between">
                    <span>+{addOns.extraTeamSeats} team seats</span>
                    <span>${addOns.extraTeamSeats * 29}/mo</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-3 font-semibold">
                  <div className="mb-1 flex justify-between text-sm text-white/80">
                    <span>Total monthly tokens</span>
                    <span>{totalTokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total ({billing.interval})</span>
                    <span>${total}{billing.interval === 'yearly' ? '/yr' : '/mo'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className={cn('border border-green-500/30', CARD_BG)}>
              <CardContent className="flex items-center gap-4 py-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="font-semibold">Receipt and confirmation</p>
                  <p className={cn('text-sm', MUTED)}>Receipt and confirmation are sent after Stripe checkout completes.</p>
                </div>
              </CardContent>
            </Card>
            {checkoutError && <p className="text-sm text-red-400">{checkoutError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="border-white/20" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button className="flex-1 bg-indigo-600 py-6 hover:bg-indigo-500" onClick={handlePayWithStripe} disabled={checkoutLoading}>
                {checkoutLoading ? 'Redirecting to Stripe...' : 'Pay with Stripe'}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading checkout...</div>}>
      <CheckoutPageContent />
    </Suspense>
  )
}
