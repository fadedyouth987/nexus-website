import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SITE_NAME } from '@/lib/sitemap'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { LandingWaitlistSection } from '@/components/marketing/LandingWaitlistSection'
import { cn } from '@/lib/core/utils'

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

/** Server Component: static marketing HTML avoids full-tree hydration (and extension-injected attrs like `bis_skin_checked`). */
export default function LandingPage() {
  return (
    <div className="landing-lux-root min-h-screen bg-background text-foreground">
      <div className="landing-lux-backdrop" aria-hidden>
        <div className="landing-lux-orb landing-lux-orb-1" />
        <div className="landing-lux-orb landing-lux-orb-2" />
        <div className="landing-lux-orb landing-lux-orb-3" />
        <div className="landing-lux-grid" />
      </div>

      <div className="landing-lux-content">
        <section className="overflow-hidden py-20 sm:py-24">
          <div className="app-page-shell grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(520px,0.95fr)] lg:items-center">
            <div className="space-y-7">
              <div className={cn('app-section-kicker', 'landing-lux-kicker')}>
                Beta launch system for AI creators
              </div>
              <div className="app-section-copy space-y-4">
                <h1
                  className={cn(
                    'app-section-title max-w-4xl text-4xl sm:text-5xl md:text-6xl',
                    'landing-lux-title'
                  )}
                >
                  {SITE_NAME}
                </h1>
                <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
                  Create, automate, and grow AI influencers end-to-end.
                </p>
                <p className="app-section-description max-w-2xl sm:text-base">
                  The full operating system from identity creation to automation, publishing, analytics,
                  monetization, and agency workflows. Not just images, a brand that runs.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button
                  asChild
                  size="lg"
                  className="relative overflow-hidden border border-primary/20 bg-primary shadow-[0_0_40px_-8px_oklch(0.55_0.2_280/0.55)] transition-[box-shadow,transform] duration-500 hover:shadow-[0_0_52px_-6px_oklch(0.6_0.22_290/0.65)]"
                >
                  <Link href="#waitlist">
                    Join the beta waitlist
                    <span className="absolute -right-2 -top-2 flex h-5 items-center rounded-full bg-emerald-500 px-2 text-[10px] font-bold text-white shadow-[0_0_16px_oklch(0.65_0.2_160/0.7)]">
                      Early access
                    </span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="border-primary/25 bg-background/40 backdrop-blur-md transition-[border-color,box-shadow] duration-300 hover:border-primary/40 hover:shadow-[0_0_24px_-10px_oklch(0.55_0.18_280/0.4)]"
                >
                  <Link href="/auth">Sign in</Link>
                </Button>
              </div>
              <div className="app-stat-grid max-w-2xl">
                <div className={cn('app-surface-card landing-lux-stat p-4')}>
                  <div className="text-2xl font-semibold tabular-nums">24/7</div>
                  <div className="mt-1 text-sm text-muted-foreground">Always-on content engine</div>
                </div>
                <div className={cn('app-surface-card landing-lux-stat p-4')}>
                  <div className="text-2xl font-semibold tabular-nums">3x</div>
                  <div className="mt-1 text-sm text-muted-foreground">Faster launch to first funnel</div>
                </div>
                <div className={cn('app-surface-card landing-lux-stat p-4')}>
                  <div className="text-2xl font-semibold tabular-nums">1 OS</div>
                  <div className="mt-1 text-sm text-muted-foreground">Studio, scheduler, and analytics</div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="landing-lux-hero-panel p-3">
                {/* Plain <img>: always served from /public; avoids next/image edge cases for local SVGs */}
                <img
                  src="/landing/hero-showcase.svg"
                  alt="Nexus Studio hero artwork showing creator, automation, and growth surfaces"
                  width={1600}
                  height={960}
                  decoding="async"
                  fetchPriority="high"
                  className="relative z-10 h-auto w-full rounded-[24px]"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-muted/20 py-16">
          <div className="app-page-shell space-y-10">
            <div className="app-section-header text-center">
              <div className="app-section-copy">
                <div className={cn('app-section-kicker', 'landing-lux-kicker')}>Core product motion</div>
                <h2 className="app-section-title text-2xl">One platform. Three jobs.</h2>
              </div>
              <p className="app-section-description mx-auto max-w-2xl">
                Purpose-built visuals now map to the core motions in the product.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {VALUE_PROPS.map((prop) => (
                <Card key={prop.title} className={cn('app-feature-card landing-lux-card overflow-hidden')}>
                  <div className="border-b border-border bg-background/60 p-3">
                    <img
                      src={prop.image}
                      alt={prop.alt}
                      width={1200}
                      height={900}
                      decoding="async"
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

        <section className="border-t border-border py-16">
          <div className="app-page-shell grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] lg:items-center">
            <div className="app-section-copy space-y-5">
              <div>
                <div className={cn('app-section-kicker', 'landing-lux-kicker')}>Product preview</div>
                <h2 className="app-section-title text-2xl">See it in action</h2>
              </div>
              <p className="app-section-description">
                A looping motion asset now demonstrates the Studio, identity lock, scheduler, and engagement
                surfaces without needing a live product walkthrough.
              </p>
              <div className="space-y-3 text-sm text-muted-foreground">
                <div className={cn('app-surface-card landing-lux-stat p-4')}>Prompt to image generation</div>
                <div className={cn('app-surface-card landing-lux-stat p-4')}>
                  Identity continuity across content
                </div>
                <div className={cn('app-surface-card landing-lux-stat p-4')}>
                  Automated publishing and reporting
                </div>
              </div>
            </div>

            <div className="landing-lux-hero-panel p-4">
              <img
                src="/landing/studio-demo.svg"
                alt="Animated demo reel showing the Nexus Studio workflow"
                width={1600}
                height={900}
                decoding="async"
                className="relative z-10 h-auto w-full rounded-[24px]"
              />
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-muted/20 py-12">
          <div className="app-page-shell text-center">
            <h2 className="text-xl font-semibold tracking-tight">Built for creators who scale</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              From solo influencers to multi-creator agencies, NexGen Studio provides the complete operating
              system for AI-driven content creation, scheduling, and monetization.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-8 text-muted-foreground sm:gap-12">
              <div className={cn('landing-lux-stat rounded-xl border border-border/60 bg-background/50 px-6 py-4')}>
                <div className="text-2xl font-bold tabular-nums text-foreground">12+</div>
                <div className="text-xs">Platforms supported</div>
              </div>
              <div className={cn('landing-lux-stat rounded-xl border border-border/60 bg-background/50 px-6 py-4')}>
                <div className="text-2xl font-bold tabular-nums text-foreground">24/7</div>
                <div className="text-xs">Content automation</div>
              </div>
              <div className={cn('landing-lux-stat rounded-xl border border-border/60 bg-background/50 px-6 py-4')}>
                <div className="text-2xl font-bold tabular-nums text-foreground">GPU</div>
                <div className="text-xs">Accelerated generation</div>
              </div>
            </div>
          </div>
        </section>

        <LandingWaitlistSection />

        <section className="border-t border-border py-16">
          <div className="app-page-shell max-w-2xl space-y-5 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Ready for early access?</h2>
            <Button
              asChild
              size="lg"
              className="shadow-[0_0_36px_-10px_oklch(0.55_0.2_280/0.5)] transition-shadow duration-500 hover:shadow-[0_0_48px_-8px_oklch(0.62_0.22_290/0.6)]"
            >
              <Link href="#waitlist">Join the beta waitlist</Link>
            </Button>
          </div>
        </section>
        <MarketingFooter />
      </div>
    </div>
  )
}
