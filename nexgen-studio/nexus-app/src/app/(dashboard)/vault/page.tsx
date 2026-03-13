'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AppHero } from '@/components/layout/AppHero'
import { EmptyState } from '@/components/ui/EmptyState'
import { Archive, Shield, Lock, Eye } from 'lucide-react'
import { PLATFORM_POLICY } from '@/lib/social/platformPolicy'

export default function VaultPage() {
  const [verified, setVerified] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch('/api/age-gate', { credentials: 'include' })
        const data = await res.json().catch(() => ({}))
        if (!cancelled) setVerified((data as { verified?: boolean }).verified === true)
      } catch {
        if (!cancelled) setVerified(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [])

  const nsfwPlatforms = useMemo(() =>
    Object.entries(PLATFORM_POLICY)
      .filter(([, p]) => p.supportsNsfw)
      .map(([id, p]) => ({ id, ...p })),
    []
  )

  if (verified === null) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!verified) {
    return (
      <div className="space-y-[var(--section-gap)]">
        <AppHero
          eyebrow="Premium Content"
          title="Vault"
          description="Age-restricted and premium content management. Complete verification to access."
        />
        <Card className="mx-auto max-w-xl border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Verification required
            </CardTitle>
            <CardDescription>
              Vault is for 18+ and age-restricted content. Complete age verification, terms, and OTP on the verification page to access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/settings/verification">Go to Age & NSFW verification</Link>
            </Button>
            <p className="mt-3 text-xs text-muted-foreground">
              For SFW content only, use <Link href="/gallery" className="underline">Gallery</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Premium Content"
        title="Vault"
        description="Manage premium, age-restricted, and exclusive content for NSFW-capable platforms."
        metrics={[
          { label: 'NSFW Platforms', value: nsfwPlatforms.length },
          { label: 'Verified', value: 'Yes' },
        ]}
        actions={
          <Button asChild size="lg">
            <Link href="/studio">Generate vault content</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {nsfwPlatforms.map((platform) => (
          <Card key={platform.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{platform.label}</CardTitle>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  platform.integration === 'live'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : platform.integration === 'stub'
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {platform.integration === 'live' ? 'Live' : platform.integration === 'stub' ? 'In Development' : 'Planned'}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                {platform.supportsSfw && (
                  <span className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px]">
                    <Eye className="h-3 w-3" /> SFW
                  </span>
                )}
                {platform.supportsNsfw && (
                  <span className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-2 py-0.5 text-[11px] text-primary">
                    <Lock className="h-3 w-3" /> NSFW
                  </span>
                )}
              </div>
              {platform.integration === 'live' ? (
                <Button size="sm" className="w-full" asChild>
                  <Link href="/dashboard/social">Connect</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="w-full" disabled>
                  {platform.integration === 'stub' ? 'Coming soon' : 'Planned'}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vault Content</CardTitle>
          <CardDescription>Your NSFW and premium content generated through Studio with vault workflows.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Archive className="h-6 w-6" />}
            title="No vault content yet"
            description="Generate content in Studio using a Vault workflow to see it here."
            action={
              <Button asChild size="sm">
                <Link href="/studio">Go to Studio</Link>
              </Button>
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
