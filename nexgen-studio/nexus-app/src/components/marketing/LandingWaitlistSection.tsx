'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/core/utils'

/**
 * Client island for waitlist POST; landing page stays a Server Component.
 */
export function LandingWaitlistSection() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [contentGoals, setContentGoals] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          contentGoals,
          source: 'landing_beta_invite',
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as { detail?: string }

      if (!response.ok) {
        throw new Error(payload.detail || 'Could not join waitlist')
      }

      setMessage('You are on the beta waitlist. We will send your invite updates by email.')
      setEmail('')
      setName('')
      setContentGoals('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit waitlist form')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section id="waitlist" className="border-t border-border py-16 scroll-mt-20">
      <div className="app-page-shell grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="app-section-copy space-y-4">
          <div>
            <div className={cn('app-section-kicker', 'landing-lux-kicker')}>Early access</div>
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

        <Card className={cn('app-feature-card')}>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="app-form-stack">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Input
                type="text"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <Textarea
                placeholder="What are your content goals? (optional)"
                value={contentGoals}
                onChange={(e) => setContentGoals(e.target.value)}
                rows={3}
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Submitting…' : 'Join beta waitlist'}
              </Button>
              {message ? <div className="app-callout app-callout-success text-sm">{message}</div> : null}
              {error ? <div className="app-callout app-callout-danger text-sm">{error}</div> : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
