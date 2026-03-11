'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SITE_NAME } from '@/lib/sitemap'

const VALUE_PROPS = [
  {
    title: 'Creation',
    body: 'Photoreal images, talking-head video, style and character presets. Identity consistency across every asset.',
    image: '/landing/creation-scene.svg',
    alt: 'Creation studio preview artwork',
  },
  {
    title: 'Automation',
    body: 'Content, scheduling, engagement, and monetization in one OS. Set rules once; your influencers run.',
    image: '/landing/automation-scene.svg',
    alt: 'Automation pipeline artwork',
  },
  {
    title: 'Growth',
    body: 'Analytics, A/B testing, multi-platform scheduling, and 30-day autopilot. Scale without the grind.',
    image: '/landing/growth-scene.svg',
    alt: 'Growth dashboard artwork',
  },
]

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
      <section className="overflow-hidden px-[var(--content-padding)] py-20 sm:py-24">
        <div className="mx-auto grid w-full max-w-[var(--content-max-width)] gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(520px,0.95fr)] lg:items-center">
          <div className="space-y-7">
            <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Beta launch system for AI creators
            </div>
            <div className="space-y-5">
              <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">{SITE_NAME}</h1>
              <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
                Create, automate, and grow AI influencers end-to-end.
              </p>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                The full operating system from identity creation to automation, publishing, analytics, monetization, and agency workflows. Not just images, a brand that runs.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/auth">Create Your Influencer</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/create">See how it works</Link>
              </Button>
            </div>
            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
                <div className="text-2xl font-semibold">24/7</div>
                <div className="mt-1 text-sm text-muted-foreground">Always-on content engine</div>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
                <div className="text-2xl font-semibold">3x</div>
                <div className="mt-1 text-sm text-muted-foreground">Faster launch to first funnel</div>
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4 shadow-sm">
                <div className="text-2xl font-semibold">1 OS</div>
                <div className="mt-1 text-sm text-muted-foreground">Studio, scheduler, and analytics</div>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-x-10 top-8 h-40 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative overflow-hidden rounded-[32px] border border-border/80 bg-card/75 p-3 shadow-2xl shadow-primary/10 backdrop-blur">
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

      <section className="border-t border-border bg-muted/20 px-[var(--content-padding)] py-16">
        <div className="mx-auto w-full max-w-[var(--content-max-width)] space-y-10">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl font-semibold">One platform. Three jobs.</h2>
            <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
              Purpose-built visuals now map to the core motions in the product.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {VALUE_PROPS.map((prop) => (
              <Card key={prop.title} className="overflow-hidden border-border bg-card">
                <div className="border-b border-border bg-background/60 p-3">
                  <Image
                    src={prop.image}
                    alt={prop.alt}
                    width={1200}
                    height={900}
                    className="h-auto w-full rounded-2xl"
                  />
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">{prop.title}</CardTitle>
                  <CardDescription>{prop.body}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-border px-[var(--content-padding)] py-16">
        <div className="mx-auto grid w-full max-w-[var(--content-max-width)] gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:items-center">
          <div className="space-y-5">
            <h2 className="text-2xl font-semibold">See it in action</h2>
            <p className="text-sm text-muted-foreground">
              A looping motion asset now demonstrates the Studio, identity lock, scheduler, and engagement surfaces without needing a live product walkthrough.
            </p>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                Prompt to image generation
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                Identity continuity across content
              </div>
              <div className="rounded-2xl border border-border bg-card/70 p-4">
                Automated publishing and reporting
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-border bg-card/85 p-4 shadow-2xl shadow-primary/10">
            <Image
              src="/landing/studio-demo.svg"
              alt="Animated demo reel showing the Nexus Studio workflow"
              width={1600}
              height={900}
              unoptimized
              className="h-auto w-full rounded-[24px]"
            />
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-muted/20 px-[var(--content-padding)] py-12">
        <div className="mx-auto w-full max-w-[var(--content-max-width)] text-center">
          <h2 className="text-xl font-semibold">Trusted by creators and agencies</h2>
          <p className="mt-3 text-sm text-muted-foreground">Logos and testimonials go here.</p>
        </div>
      </section>

      <section className="border-t border-border px-[var(--content-padding)] py-16">
        <div className="mx-auto grid w-full max-w-[var(--content-max-width)] gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Join the beta waitlist</h2>
            <p className="text-sm text-muted-foreground">
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

          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <form onSubmit={handleWaitlistSubmit} className="space-y-3">
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
                {waitlistMessage ? <p className="text-xs text-emerald-600">{waitlistMessage}</p> : null}
                {waitlistError ? <p className="text-xs text-destructive">{waitlistError}</p> : null}
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="border-t border-border px-[var(--content-padding)] py-16">
        <div className="mx-auto w-full max-w-2xl space-y-5 text-center">
          <h2 className="text-2xl font-semibold">Ready to run your first AI influencer?</h2>
          <Button asChild size="lg">
            <Link href="/auth">Create Your Influencer</Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
