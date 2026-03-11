const fs = require('fs');
const path = require('path');

const p = path.join('src', 'app', 'landing', 'page.tsx');

const content = `'use client'

import Link from 'next/link'
import { Sparkles, Zap, Users, ArrowRight, Play, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const features = [
  { title: 'AI Image Generation', description: 'Create stunning images with state-of-the-art AI models', icon: Sparkles },
  { title: 'Multi-Creator Management', description: 'Manage multiple AI influencer profiles effortlessly', icon: Users },
  { title: 'Smart Scheduling', description: 'Automate content posting with intelligent timing', icon: Zap },
]

const testimonials = [
  {
    quote: 'Nexus transformed how we manage our AI creators. The automation is incredible.',
    author: 'Sarah M.',
    role: 'Agency Owner',
    rating: 5,
  },
  {
    quote: 'From content creation to posting, everything is seamless. Highly recommend!',
    author: 'James K.',
    role: 'Content Creator',
    rating: 5,
  },
  {
    quote: 'The custom model training feature alone is worth the subscription.',
    author: 'Alex R.',
    role: 'Marketing Director',
    rating: 5,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Nexus</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
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

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center"
003e
          <div>
            <Badge variant="secondary" className="mb-4">
              ✨ The Future of AI Content Creation
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
003e
              Build <span className="text-primary">AI Influencers</span>
              <br />
              at scale
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Create, manage, and scale AI-generated content for social media. 
              Powered by state-of-the-art AI models and enterprise-grade infrastructure.
            </p>
            <div className="flex flex-col sm:flex-row gap-4"
003e
              <Button size="lg" className="gap-2" asChild>
                <Link href="/auth?tab=signup"
003e
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="gap-2">
                <Play className="h-4 w-4" />
                Watch Demo
              </Button>
            </div>
            <div className="mt-8 flex items-center gap-4 text-sm text-muted-foreground"
003e
              <span className="flex items-center gap-1">
                ✓ 14-day free trial
              </span>
              <span className="flex items-center gap-1">
                ✓ No credit card required
              </span>
            </div>
          </div>
          <div className="relative hidden lg:block">
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-muted border border-primary/20 shadow-xl"
003e
              <div className="absolute inset-0 flex items-center justify-center"
003e
                <div className="text-center p-8"
003e
                  <Sparkles className="h-16 w-16 text-primary mx-auto mb-4" />
                  <p className="text-lg font-medium">AI-Powered Content Creation</p>
                  <p className="text-sm text-muted-foreground">Generate stunning images in seconds</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12"
003e
          <h2 className="text-3xl font-bold mb-4">Everything you need</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A complete toolkit for managing AI-generated content at scale.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6"
003e
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <Card key={feature.title} className="group hover:border-primary/50 transition-colors"
003e
                <CardHeader>
                  <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4 group-hover:bg-primary/20 transition-colors"
003e
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
        <div className="text-center mt-8">
          <Button variant="outline" asChild>
            <Link href="/features" className="gap-2">
              View All Features <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Social Proof */}
      <section className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="text-center mb-12"
003e
          <h2 className="text-3xl font-bold mb-4">Loved by creators</h2>
          <p className="text-muted-foreground">See what our users are saying about Nexus.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6"
003e
          {testimonials.map((testimonial, index) => (
            <Card key={index}>
              <CardContent className="pt-6"
003e
                <div className="flex gap-1 mb-4"
003e
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-sm mb-4">"{testimonial.quote}"</p>
                <div className="text-sm"
003e
                  <span className="font-medium">{testimonial.author}</span>
                  <span className="text-muted-foreground"> • {testimonial.role}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-primary/20"
003e
          <CardContent className="py-16 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto"
003e
              Join thousands of creators using Nexus to build their AI influencer presence.
              Start with a free trial today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild>
                <Link href="/auth?tab=signup">Start Free Trial</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/pricing">Compare Plans</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="font-semibold">Nexus</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/features" className="hover:text-foreground transition-colors">Features</Link>
              <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
              <Link href="/legal" className="hover:text-foreground transition-colors">Legal</Link>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Nexus. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
`;

const dir = path.dirname(p);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}
fs.writeFileSync(p, content);
console.log('Landing page written successfully');
