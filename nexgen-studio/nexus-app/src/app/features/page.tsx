'use client'

import Link from 'next/link'
import {
  Sparkles,
  Zap,
  Users,
  Calendar,
  BarChart3,
  Shield,
  Workflow,
  Brain,
  Wand2,
  Image,
  Video,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const features = [
  {
    title: 'AI Content Generation',
    description: 'Generate images and workflow-driven media from one product surface.',
    icon: Wand2,
    highlights: ['Text-to-image generation', 'Workflow templates', 'Prompt control'],
  },
  {
    title: 'Creator Management',
    description: 'Manage multiple AI creator profiles from a single dashboard.',
    icon: Users,
    highlights: ['Multi-creator support', 'Profile management', 'Workspace organization'],
  },
  {
    title: 'Planning and Queueing',
    description: 'Plan content timing and queue posts across the currently supported publishing flow.',
    icon: Calendar,
    highlights: ['Planner workflow', 'Queue management', 'Publishing readiness'],
  },
  {
    title: 'Analytics Dashboard',
    description: 'Workspace analytics and performance reporting for the areas already wired into the current build.',
    icon: BarChart3,
    highlights: ['Workspace metrics', 'Performance breakdowns', 'Worker health visibility'],
  },
  {
    title: 'Custom Models',
    description: 'Upload and manage custom models with moderation and review gates.',
    icon: Brain,
    highlights: ['Model uploads', 'Review queues', 'Policy-aware handling'],
  },
  {
    title: 'Workflow Automation',
    description: 'Use planner, queue, publishing, and worker-driven flows to reduce manual repeat work.',
    icon: Workflow,
    highlights: ['Factory setup', 'Content planning', 'Worker dispatch'],
  },
] as const

const capabilities = [
  {
    title: 'Image Generation',
    description: 'Generate images with prompt, workflow, and output controls.',
    icon: Image,
    stats: 'Plan-dependent',
  },
  {
    title: 'Video Workflows',
    description: 'Video paths exist in the current build, with output quality depending on the template and model used.',
    icon: Video,
    stats: 'Template-dependent',
  },
  {
    title: 'Caption Drafting',
    description: 'Prompt-assisted caption and content drafting inside the current creator workflow.',
    icon: MessageSquare,
    stats: 'Workflow-assisted',
  },
] as const

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Nexus</span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/features" className="text-sm font-medium text-foreground">
              Features
            </Link>
            <Link href="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </Link>
            <Link href="/contact" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Contact
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/auth">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/auth?tab=signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20 text-center">
        <Badge variant="secondary" className="mb-4">
          Current Product Surface
        </Badge>
        <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          The current Nexus build for <span className="text-primary">AI creator operations</span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground">
          From generation to planning, publishing, and analytics, Nexus provides the working beta surfaces in one place.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/auth?tab=signup">Start With The Beta</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/pricing">View Pricing</Link>
          </Button>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="mb-4 text-center text-3xl font-bold">Core Features</h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
          Built around the product areas that already exist in the app today.
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.title} className="group transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="mb-4 w-fit rounded-lg bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-sm">{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feature.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Zap className="h-3 w-3 shrink-0 text-primary" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      <section className="container mx-auto bg-muted/30 px-4 py-16">
        <h2 className="mb-4 text-center text-3xl font-bold">Content Capabilities</h2>
        <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
          Capability labels here are limited to what the current build exposes.
        </p>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {capabilities.map((capability) => {
            const Icon = capability.icon
            return (
              <div key={capability.title} className="text-center">
                <div className="mb-4 inline-flex rounded-full bg-primary/10 p-4">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">{capability.title}</h3>
                <p className="mb-3 text-muted-foreground">{capability.description}</p>
                <Badge variant="secondary">{capability.stats}</Badge>
              </div>
            )
          })}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-8 md:flex-row">
              <div className="flex-shrink-0">
                <div className="rounded-full bg-primary/20 p-4">
                  <Shield className="h-12 w-12 text-primary" />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="mb-2 text-2xl font-bold">Operational safeguards</h3>
                <p className="mb-4 text-muted-foreground">
                  The current build includes auth-protected routes, verification gating for restricted flows, and workspace-aware product areas.
                  Formal compliance claims should be documented separately from this marketing page.
                </p>
                <div className="flex flex-wrap justify-center gap-2 md:justify-start">
                  <Badge variant="outline">Verification gating</Badge>
                  <Badge variant="outline">Workspace separation</Badge>
                  <Badge variant="outline">OAuth connectors</Badge>
                  <Badge variant="outline">Audit surfaces</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="mb-4 text-3xl font-bold">Ready to get started?</h2>
        <p className="mx-auto mb-8 max-w-lg text-muted-foreground">
          Start with the current beta product surfaces and expand as the remaining integrations are completed.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/auth?tab=signup">Start With Nexus</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/pricing">Compare Plans</Link>
          </Button>
        </div>
      </section>

      <footer className="mt-8 border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">Nexus</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
                Privacy
              </Link>
              <Link href="/legal/terms" className="transition-colors hover:text-foreground">
                Terms
              </Link>
              <Link href="/contact" className="transition-colors hover:text-foreground">
                Contact
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Nexus. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
