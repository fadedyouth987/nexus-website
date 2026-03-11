'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/core/utils'
import { TIER_PLANS } from '@/lib/billing/tierPlans'

type PublicPlan = {
  id: string
  title: string
  description: string
  price: number
  features: readonly string[]
  highlighted?: boolean
}

const publicPlans: readonly PublicPlan[] = [
  {
    id: 'tier1',
    title: 'Tier 1',
    description: 'For solo operators validating one creator workflow.',
    price: TIER_PLANS.tier1.monthlyPrice,
    features: [
      '1 AI Influencer',
      `${TIER_PLANS.tier1.monthlyTokens} tokens / month`,
      'Image generation workflows',
      'Planner and publish setup',
      `${TIER_PLANS.tier1.storageGb} GB storage`,
    ],
  },
  {
    id: 'tier2',
    title: 'Tier 2',
    description: 'For creators running a fuller production and publishing cycle.',
    price: TIER_PLANS.tier2.monthlyPrice,
    highlighted: true,
    features: [
      '5 AI Influencers',
      `${TIER_PLANS.tier2.monthlyTokens} tokens / month`,
      'Image and video workflow access',
      'Planner, publishing, and reporting surfaces',
      'Team seats: 1-3',
      `${TIER_PLANS.tier2.storageGb} GB storage`,
    ],
  },
  {
    id: 'tier3',
    title: 'Tier 3',
    description: 'For agencies and multi-creator teams.',
    price: TIER_PLANS.tier3.monthlyPrice,
    features: [
      '20 AI Influencers',
      `${TIER_PLANS.tier3.monthlyTokens} tokens / month`,
      'Higher-volume generation',
      'Client reporting',
      'API access',
      'Team seats: 3-15',
      `${TIER_PLANS.tier3.storageGb} GB storage`,
    ],
  },
] as const

const comparisonRows: [string, string, string, string][] = [
  ['AI Influencers', '1', '5', '20'],
  ['Monthly tokens', String(TIER_PLANS.tier1.monthlyTokens), String(TIER_PLANS.tier2.monthlyTokens), String(TIER_PLANS.tier3.monthlyTokens)],
  ['Storage (GB)', String(TIER_PLANS.tier1.storageGb), String(TIER_PLANS.tier2.storageGb), String(TIER_PLANS.tier3.storageGb)],
  ['Image workflows', 'Yes', 'Yes', 'Yes'],
  ['Video workflows', 'Limited', 'Expanded', 'Expanded'],
  ['Planning and publishing', 'Basic', 'Full', 'Full'],
  ['Reporting', 'Basic', 'Workspace', 'Client-ready'],
  ['Team seats', '1', '1-3', '3-15'],
  ['API access', 'No', 'No', 'Yes'],
  ['NSFW access', 'Verification + add-on', 'Verification gated', 'Verification gated'],
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0B0C0F] text-white">
      <HeroSection />
      <PricingSection />
      <FeatureComparison />
      <CreditSlider />
      <FAQSection />
    </div>
  )
}

function HeroSection() {
  return (
    <section className="bg-gradient-to-b from-black to-[#0B0C0F] py-24 text-center">
      <h1 className="text-5xl font-bold">Pricing aligned to the current build</h1>
      <p className="mt-4 text-lg text-white/60">
        Choose the tier that matches your creator volume, workflow depth, and team size.
      </p>
      <Button className="mt-8 px-10 py-6 text-lg" asChild>
        <Link href="/checkout">Get Started</Link>
      </Button>
    </section>
  )
}

function PricingSection() {
  return (
    <section className="grid grid-cols-1 gap-8 px-6 pb-20 md:grid-cols-3 md:px-20">
      {publicPlans.map((plan) => (
        <PricingCard
          key={plan.id}
          title={plan.title}
          price={`$${plan.price}`}
          description={plan.description}
          planId={plan.id}
          features={plan.features}
          highlighted={plan.highlighted}
        />
      ))}
    </section>
  )
}

type PricingCardProps = {
  title: string
  price: string
  description: string
  planId: string
  features: readonly string[]
  highlighted?: boolean
}

function PricingCard({ title, price, description, planId, features, highlighted }: PricingCardProps) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-2xl border border-white/5 bg-[#111216] p-8',
        highlighted && 'border-indigo-500/50 shadow-lg shadow-indigo-500/20'
      )}
    >
      <h3 className="text-2xl font-semibold">{title}</h3>
      <p className="mt-2 text-white/60">{description}</p>

      <div className="mt-6">
        <span className="text-5xl font-bold">{price}</span>
        <span className="ml-1 text-white/60">/mo</span>
      </div>

      <ul className="mt-6 space-y-3 text-white/80">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2">
            <span className="text-indigo-400">•</span>
            {feature}
          </li>
        ))}
      </ul>

      <Button className="mt-auto w-full py-6 text-lg" asChild>
        <Link href={`/checkout?plan=${planId}`}>Choose Plan</Link>
      </Button>
    </div>
  )
}

function FeatureComparison() {
  return (
    <section className="mt-20 px-6 md:px-20">
      <h2 className="mb-10 text-3xl font-bold">Compare features</h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-white/10">
              <th className="p-4">Feature</th>
              <th className="p-4">Tier 1</th>
              <th className="p-4">Tier 2</th>
              <th className="p-4">Tier 3</th>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map(([feature, c1, c2, c3]) => (
              <tr key={feature} className="border-b border-white/5">
                <td className="p-4">{feature}</td>
                <td className="p-4">{c1}</td>
                <td className="p-4">{c2}</td>
                <td className="p-4">{c3}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function CreditSlider() {
  const [credits, setCredits] = useState(1000)

  return (
    <section className="px-6 py-20 md:px-20">
      <div className="mx-auto max-w-xl rounded-xl border border-white/5 bg-[#111216] p-8">
        <h3 className="mb-4 text-2xl font-semibold">Customize your credits</h3>

        <Slider min={300} max={5000} step={100} value={[credits]} onValueChange={(v) => setCredits(v[0] ?? 1000)} />

        <p className="mt-4 text-white/60">
          {credits} credits / month - ${(credits / 100) * 5} / month
        </p>
      </div>
    </section>
  )
}

function FAQSection() {
  const faqs = [
    {
      q: 'How do credits work?',
      a: 'Credits cover generation and processing workloads. Exact usage depends on the workflow, model, and output count you run.',
    },
    {
      q: 'Can I upgrade or downgrade anytime?',
      a: 'Yes. Billing changes are handled through Stripe and reflected in your active subscription settings.',
    },
    {
      q: 'Do unused credits roll over?',
      a: 'No. Credits reset on the billing cycle to keep capacity predictable.',
    },
    {
      q: 'Do you support NSFW content?',
      a: 'Yes, but it is gated behind age verification, terms acceptance, and explicit opt-in controls.',
    },
  ]

  return (
    <section className="px-6 pb-32 md:px-20">
      <h2 className="mb-10 text-3xl font-bold">Frequently Asked Questions</h2>

      <div className="space-y-6">
        {faqs.map((faq) => (
          <div key={faq.q} className="rounded-xl border border-white/5 bg-[#111216] p-6">
            <h4 className="text-xl font-semibold">{faq.q}</h4>
            <p className="mt-2 text-white/60">{faq.a}</p>
          </div>
        ))}
      </div>

      <footer className="mt-8 border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-muted-foreground md:flex-row">
          <div className="font-semibold text-white">Nexus</div>
          <div className="flex items-center gap-6">
            <Link href="/legal/privacy" className="transition-colors hover:text-white">
              Privacy
            </Link>
            <Link href="/legal/terms" className="transition-colors hover:text-white">
              Terms
            </Link>
            <Link href="/contact" className="transition-colors hover:text-white">
              Contact
            </Link>
          </div>
          <p>© {new Date().getFullYear()} Nexus. All rights reserved.</p>
        </div>
      </footer>
    </section>
  )
}
