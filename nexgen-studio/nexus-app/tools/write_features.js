const fs = require('fs');
const path = require('path');

const p = path.join('src', 'app', 'features', 'page.tsx');

const content = `'use client'

import Link from 'next/link'
import { Sparkles, Zap, Users, Calendar, BarChart3, Shield, Workflow, Brain, Wand2, Image, Video, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const features = [
  {
    title: 'AI Content Generation',
    description: 'Generate stunning images and videos with our state-of-the-art AI models. Powered by A100 GPUs for lightning-fast results.',
    icon: Wand2,
    highlights: ['Text-to-image generation', 'Style transfer', 'Custom model training'],
  },
  {
    title: 'Creator Management',
    description: 'Manage multiple AI influencer profiles from a single dashboard. Track performance, schedule content, and grow your audience.',
    icon: Users,
    highlights: ['Multi-creator support', 'Profile analytics', 'Audience insights'],
  },
  {
    title: 'Smart Scheduling',
    description: 'Schedule posts across platforms with intelligent timing recommendations based on your audience engagement patterns.',
    icon: Calendar,
    highlights: ['Multi-platform scheduling', 'Optimal timing', 'Auto-posting'],
  },
  {
    title: 'Analytics Dashboard',
    description: 'Deep insights into your content performance with real-time metrics and AI-powered recommendations.',
    icon: BarChart3,
    highlights: ['Engagement metrics', 'Growth tracking', 'Performance reports'],
  },
  {
    title: 'Custom Model Training',
    description: 'Train custom AI models on your specific style and content. Create unique, recognizable brand aesthetics.',
    icon: Brain,
    highlights: ['Fine-tuning support', 'Style consistency', 'Brand identity'],
  },
  {
    title: 'Workflow Automation',
    description: 'Automate repetitive tasks with intelligent workflows. From content creation to posting, let AI handle the heavy lifting.',
    icon: Workflow,
    highlights: ['30-day autopilot', 'Batch generation', 'Smart workflows'],
  },
]

const capabilities = [
  {
    title: 'Image Generation',
    description: 'High-quality image generation with advanced control over style, composition, and details.',
    icon: Image,
    stats: '50-500+ images/month',
  },
  {
    title: 'Video Creation',
    description: 'Transform static images into engaging video content with AI-powered animation and effects.',
    icon: Video,
    stats: 'Coming soon',
  },
  {
    title: 'Caption Writing',
    description: 'AI-generated captions that match your brand voice and optimize engagement.',
    icon: MessageSquare,
    stats: 'Unlimited captions',
  },
]

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Nexus</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/features" className="text-sm font-medium text-foreground">Features</Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link href="/auth">Sign In</Link></Button>
            <Button asChild><Link href="/auth?tab=signup">Get Started</Link></Button>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-20 text-center">
        <Badge variant="secondary" className="mb-4">Powerful AI Creator Tools</Badge>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
          Everything you need to <span className="text-primary">build AI creators</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          From image generation to scheduling, Nexus provides a complete toolkit for managing AI influencer content at scale.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild><Link href="/auth?tab=signup">Start Free Trial</Link></Button>
          <Button size="lg" variant="outline" asChild><Link href="/pricing">View Pricing</Link></Button>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center mb-4">Core Features</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">Built for creators who demand professional results with minimal effort.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.title} className="group hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-sm">{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {feature.highlights.map((highlight) => (
                      <li key={highlight} className="text-sm text-muted-foreground flex items-center gap-2">
                        <Zap className="h-3 w-3 text-primary shrink-0" />
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

      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <h2 className="text-3xl font-bold text-center mb-4">Content Capabilities</h2>
        <p className="text-muted-foreground text-center mb-12 max-w-2xl mx-auto">Create, manage, and publish all your AI-generated content from one place.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {capabilities.map((cap) => {
            const Icon = cap.icon
            return (
              <div key={cap.title} className="text-center">
                <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">{cap.title}</h3>
                <p className="text-muted-foreground mb-3">{cap.description}</p>
                <Badge variant="secondary">{cap.stats}</Badge>
              </div>
            )
          })}
        </div>
      </section>

      <section className="container mx-auto px-4 py-16">
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="py-12">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0">
                <div className="p-4 rounded-full bg-primary/20">
                  <Shield className="h-12 w-12 text-primary" />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-2xl font-bold mb-2">Enterprise-Grade Security</h3>
                <p className="text-muted-foreground mb-4">Your data is protected with industry-leading security practices. We use encrypted storage, secure authentication, and isolated workspaces to ensure your content remains private and secure.</p>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  <Badge variant="outline">SOC 2 Compliant</Badge>
                  <Badge variant="outline">GDPR Ready</Badge>
                  <Badge variant="outline">Encrypted Storage</Badge>
                  <Badge variant="outline">2FA Available</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">Join thousands of creators using Nexus to build their AI influencer presence. Start with a free trial today.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild><Link href="/auth?tab=signup">Start Free Trial</Link></Button>
          <Button size="lg" variant="outline" asChild><Link href="/pricing">Compare Plans</Link></Button>
        </div>
      </section>

      <footer className="border-t py-8 mt-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">Nexus</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/legal" className="hover:text-foreground transition-colors">Legal</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </div>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Nexus. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
`;

fs.writeFileSync(p, content);
console.log('Features page written successfully');
