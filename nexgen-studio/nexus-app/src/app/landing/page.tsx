'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SITE_NAME } from '@/lib/sitemap'
import { BETA_CAPABILITY_CHECKLIST, HERO_STATS, VALUE_PROP_BLOCKS } from '@/lib/marketing/productTruth'

export default function LandingPage() {
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistName, setWaitlistName] = useState('')
  const [waitlistGoals, setWaitlistGoals] = useState('')
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false)
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null)
  const [waitlistError, setWaitlistError] = useState<string | null>(null)

  const handleWaitlistSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setWaitlistSubmitting(true)
    setWaitlistError(null)
    setWaitlistMessage(null)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: waitlistEmail,
          name: waitlistName,
          contentGoals: waitlistGoals,
          source: 'landing_beta_invite',
        }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error((payload as { detail?: string }).detail || 'Could not join waitlist')
      }

      setWaitlistMessage('You are on the beta waitlist. We will send your invite updates by email.')
      setWaitlistEmail('')
      setWaitlistName('')
      setWaitlistGoals('')
    } catch (error) {
      setWaitlistError(error instanceof Error ? error.message : 'Failed to submit waitlist form')
    } finally {
      setWaitlistSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <section className="overflow-hidden py-20 sm:py-24">
        <div className="app-page-shell grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(520px,0.95fr)] lg:items-center">
          <div className="space-y-7">
            <div className="app-section-kicker">
              Beta launch system for AI creators
            </div>
            <div className="app-section-copy space-y-4">
              <h1 className="app-section-title max-w-4xl text-4xl sm:text-5xl md:text-6xl">{SITE_NAME}</h1>
              <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
                Create AI influencers, run planner-to-publish automation, and measure what ships—stated plainly for beta.
              </p>
              <p className="app-section-description max-w-2xl sm:text-base">
                One product surface for Studio generation, scheduling, vaulting, monetization, and org billing. Live OAuth today covers
                Instagram and Facebook; other networks and A/B experiment tooling are staged—see the checklist below and the Learn docs
                for the exact matrix.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="relative">
                <Link href="/auth">
                  Create Your Influencer
                  <span className="absolute -right-2 -top-2 flex h-5 items-center rounded-full bg-emerald-500 px-2 text-[10px] font-bold text-white">
                    Free
                  </span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/automation/factory">
                  Quick Start (Recommended)
                </Link>
              </Button>
            </div>
            <div className="app-stat-grid max-w-2xl">
              {HERO_STATS.map((stat) => (
                <div key={stat.value} className="app-surface-card p-4">
                  <div className="text-2xl font-semibold tabular-nums">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-x-10 top-8 h-40 rounded-full bg-primary/20 blur-3xl" />
            <div className="app-feature-card relative overflow-hidden p-3">
              <Image
                src="/landing/hero-showcase.svg"
                alt="Nexus Studio hero artwork showing creator, automation, and growth surfaces"
                width={1600}
                height={960}
                priority
                className="h-auto w-full rounded-[24px]"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/20 py-16">
        <div className="app-page-shell space-y-10">
          <div className="app-section-header text-center">
            <div className="app-section-copy">
              <div className="app-section-kicker">Core product motion</div>
              <h2 className="app-section-title text-2xl">One platform. Three jobs.</h2>
            </div>
            <p className="app-section-description mx-auto max-w-2xl">
              Each pillar maps to real routes and workers; bullets spell out what is live, what queues on GPU, and what is still on the roadmap.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {VALUE_PROP_BLOCKS.map((prop) => (
              <Card key={prop.title} className="app-feature-card overflow-hidden">
                <div className="border-b border-border bg-background/60 p-3">
                  <Image
                    src={prop.image}
                    alt={prop.alt}
                    width={1200}
                    height={900}
                    loading="lazy"
                    className="h-auto w-full rounded-2xl"
                  />
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{prop.title}</CardTitle>
                  <CardDescription className="space-y-3">
                    <span className="block font-medium text-foreground">{prop.lead}</span>
                    <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                      {prop.details.map((line, idx) => (
                        <li key={`${prop.title}-${idx}`}>{line}</li>
                      ))}
                    </ul>
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="app-page-shell space-y-8">
          <div className="app-section-header text-center">
            <div className="app-section-kicker">Beta scope</div>
            <h2 className="app-section-title text-2xl">What works now, what is staged, why it loads quickly</h2>
            <p className="app-section-description mx-auto max-w-2xl">
              No implied guarantees—this is the same story the Learn docs and social dashboard matrix use.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {BETA_CAPABILITY_CHECKLIST.map((item) => (
              <Card key={item.title} className="app-feature-card">
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">{item.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="text-center">
            <Button asChild variant="outline">
              <Link href="/learn">Open the full Learn checklist</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="app-page-shell grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:items-center">
          <div className="app-section-copy space-y-5">
            <div>
              <div className="app-section-kicker">Product preview</div>
              <h2 className="app-section-title text-2xl">See it in action</h2>
            </div>
            <p className="app-section-description">
              Illustrative artwork—not a live screen recording. Pair it with /studio for real generation, /automation/planner for queues, and
              /dashboard/social for connector status.
            </p>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="app-surface-card p-4">Studio: prompts, presets, ComfyUI-backed renders</div>
              <div className="app-surface-card p-4">Identity: reference-driven consistency across assets</div>
              <div className="app-surface-card p-4">Publish path: planner → dispatch → worker → live IG/FB today</div>
            </div>
          </div>

          <div className="app-feature-card overflow-hidden p-4">
            <Image
              src="/landing/studio-demo.svg"
              alt="Animated demo reel showing the Nexus Studio workflow"
              width={1600}
              height={900}
              loading="lazy"
              unoptimized
              className="h-auto w-full rounded-[24px]"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/20 py-12">
        <div className="app-page-shell text-center">
          <h2 className="text-xl font-semibold">Built for agencies and solo operators</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Multi-workspace and org billing exist in-product; public testimonials are not shown here yet. Prefer proof? Run the factory flow,
            connect a sandbox Meta app, and watch planner → publish with your own data.
          </p>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="app-page-shell grid gap-8 lg:grid-cols-2">
          <div className="app-section-copy space-y-4">
            <div>
              <div className="app-section-kicker">Early access</div>
              <h2 className="app-section-title text-2xl">Join the beta waitlist</h2>
            </div>
            <p className="app-section-description">
              Get early access, share your content goals, and help shape onboarding and 30-day planning.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link href="/onboarding">Try onboarding</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="/auth">Sign in</Link>
              </Button>
            </div>
          </div>

          <Card className="app-feature-card">
            <CardContent className="p-4">
              <form onSubmit={handleWaitlistSubmit} className="app-form-stack">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={waitlistEmail}
                  onChange={(e) => setWaitlistEmail(e.target.value)}
                  required
                />
                <Input
                  type="text"
                  placeholder="Name (optional)"
                  value={waitlistName}
                  onChange={(e) => setWaitlistName(e.target.value)}
                />
                <Textarea
                  placeholder="What are your content goals? (optional)"
                  value={waitlistGoals}
                  onChange={(e) => setWaitlistGoals(e.target.value)}
                  rows={3}
                />
                <Button type="submit" className="w-full" disabled={waitlistSubmitting}>
                  {waitlistSubmitting ? 'Submitting...' : 'Join beta waitlist'}
                </Button>
                {waitlistMessage ? <div className="app-callout app-callout-success text-sm">{waitlistMessage}</div> : null}
                {waitlistError ? <div className="app-callout app-callout-danger text-sm">{waitlistError}</div> : null}
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="app-page-shell max-w-2xl space-y-5 text-center">
          <h2 className="text-2xl font-semibold">Ready to run your first AI influencer?</h2>
          <Button asChild size="lg">
            <Link href="/auth">Create Your Influencer</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
