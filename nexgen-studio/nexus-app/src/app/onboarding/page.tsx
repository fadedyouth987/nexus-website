'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import apiFetch from '@/lib/core/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

function detectTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export default function OnboardingPage() {
  const { status } = useSession()
  const router = useRouter()

  const [planName, setPlanName] = useState('')
  const [niche, setNiche] = useState('')
  const [contentGoal, setContentGoal] = useState('')
  const [audience, setAudience] = useState('')
  const [platformsCsv, setPlatformsCsv] = useState('instagram, tiktok')
  const [postingFrequencyPerDay, setPostingFrequencyPerDay] = useState(1)
  const [tone, setTone] = useState('')
  const [visualStyle, setVisualStyle] = useState('')
  const [monetizationGoal, setMonetizationGoal] = useState('')
  const [constraints, setConstraints] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth?callbackUrl=/onboarding')
    }
  }, [status, router])

  const canSubmit = useMemo(() => {
    return !submitting && niche.trim().length > 0 && contentGoal.trim().length > 0
  }, [submitting, niche, contentGoal])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const platforms = platformsCsv
        .split(',')
        .map((platform) => platform.trim().toLowerCase())
        .filter(Boolean)

      const response = await apiFetch('/mvp/plan', {
        method: 'POST',
        body: JSON.stringify({
          planName: planName.trim() || undefined,
          niche: niche.trim(),
          contentGoal: contentGoal.trim(),
          audience: audience.trim() || undefined,
          platforms,
          postingFrequencyPerDay,
          tone: tone.trim() || undefined,
          visualStyle: visualStyle.trim() || undefined,
          monetizationGoal: monetizationGoal.trim() || undefined,
          constraints: constraints.trim() || undefined,
          timezone: detectTimezone(),
        }),
      })

      const payload = await response.json().catch(() => ({}))
      const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {}

      if (!response.ok) {
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Failed to generate plan')
      }

      const planId = typeof data.planId === 'string' ? data.planId : ''
      if (!planId) {
        throw new Error('Plan ID missing from response')
      }

      router.push(`/plan/${planId}`)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to create plan')
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Onboarding: describe your content goals</CardTitle>
          <CardDescription>
            Fill this once. We will generate a complete 30-day plan you can export and refine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="planName">Plan name (optional)</Label>
              <Input
                id="planName"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="30-day growth sprint"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="niche">Niche</Label>
              <Input
                id="niche"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Luxury lifestyle, fitness, AI creator education..."
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contentGoal">Primary content goal</Label>
              <Textarea
                id="contentGoal"
                value={contentGoal}
                onChange={(e) => setContentGoal(e.target.value)}
                rows={3}
                placeholder="Example: grow to 10k followers and build weekly paid subscriber demand."
                required
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="audience">Audience (optional)</Label>
                <Input
                  id="audience"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  placeholder="Women 21-34, US + UK"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="platforms">Platforms (comma separated)</Label>
                <Input
                  id="platforms"
                  value={platformsCsv}
                  onChange={(e) => setPlatformsCsv(e.target.value)}
                  placeholder="instagram, tiktok"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="frequency">Posts per day</Label>
                <Input
                  id="frequency"
                  type="number"
                  min={1}
                  max={10}
                  value={postingFrequencyPerDay}
                  onChange={(e) => setPostingFrequencyPerDay(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tone">Tone (optional)</Label>
                <Input
                  id="tone"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="Confident, playful, educational"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="visualStyle">Visual style (optional)</Label>
                <Input
                  id="visualStyle"
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  placeholder="Clean editorial, cinematic"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monetizationGoal">Monetization goal (optional)</Label>
                <Input
                  id="monetizationGoal"
                  value={monetizationGoal}
                  onChange={(e) => setMonetizationGoal(e.target.value)}
                  placeholder="Drive subscriptions, affiliate conversions"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="constraints">Constraints (optional)</Label>
              <Textarea
                id="constraints"
                value={constraints}
                onChange={(e) => setConstraints(e.target.value)}
                rows={3}
                placeholder="Brand safety, no explicit themes, avoid political topics..."
              />
            </div>

            {error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : null}

            <Button type="submit" disabled={!canSubmit} className="w-full">
              {submitting ? 'Generating 30-day plan...' : 'Generate 30-day plan'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
