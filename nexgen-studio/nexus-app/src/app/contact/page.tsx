'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export default function ContactPage() {
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('general')
  const [severity, setSeverity] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          subject,
          category,
          severity,
          message,
          path: typeof window !== 'undefined' ? window.location.pathname : '/contact',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { detail?: string }).detail || 'Failed to submit support request')
      }
      const ticketId = (data as { ticketId?: string }).ticketId || ''
      setSuccess(`Support request submitted${ticketId ? ` (Ticket ${ticketId})` : ''}.`)
      setSubject('')
      setMessage('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit support request')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contact Support"
        description="Get help with setup, billing, verification, social publishing, or automation workflows."
      />

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      ) : null}
      {success ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300">{success}</div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Submit a support ticket</CardTitle>
            <CardDescription>We recommend adding clear steps, screenshots, and expected vs actual behavior.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="support-email">Email</Label>
                <Input id="support-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-subject">Subject</Label>
                <Input id="support-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Issue summary" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-category">Category</Label>
                <select id="support-category" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="general">General</option>
                  <option value="setup">Setup</option>
                  <option value="billing">Billing</option>
                  <option value="verification">Age & NSFW verification</option>
                  <option value="automation">Automation</option>
                  <option value="publishing">Publishing</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="support-severity">Severity</Label>
                <select id="support-severity" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={severity} onChange={(e) => setSeverity(e.target.value as 'low' | 'normal' | 'high' | 'urgent')}>
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="support-message">Message</Label>
              <Textarea id="support-message" rows={7} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Describe the issue, steps to reproduce, expected result, and actual result." />
            </div>
            <Button onClick={() => void submit()} disabled={submitting || !email.trim() || !subject.trim() || message.trim().length < 10}>
              {submitting ? 'Submitting...' : 'Submit support ticket'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick links</CardTitle>
            <CardDescription>Resolve common issues faster.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <a href="/learn" className="block underline">Setup documentation</a>
            <a href="/settings/verification" className="block underline">Age & NSFW verification</a>
            <a href="/settings/billing" className="block underline">Billing settings</a>
            <a href="/dashboard/social" className="block underline">Socials — Link your platform accounts</a>
            <p className="pt-2 text-muted-foreground">Support hours: Mon–Fri, 9am–6pm UTC.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}