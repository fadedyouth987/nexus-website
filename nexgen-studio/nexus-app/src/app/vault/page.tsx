'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Archive, Shield } from 'lucide-react'
import apiFetch from '@/lib/core/api'

type Platform = {
  id: string
  name: string
  stage: string
  supports_nsfw: boolean
}

export default function VaultPage() {
  const [verified, setVerified] = useState<boolean | null>(null)
  const [platforms, setPlatforms] = useState<Platform[] | null>(null)

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
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!verified) {
      return
    }
    let cancelled = false
    const load = async () => {
      const response = await apiFetch('/automation/platforms')
      if (cancelled) return
      if (!response.ok) {
        setPlatforms([])
        return
      }
      const data = (await response.json()) as Platform[]
      setPlatforms(data.filter((item) => item.stage === 'vault'))
    }
    load()
    return () => {
      cancelled = true
    }
  }, [verified])

  if (verified === null) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!verified) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Vault"
          description="Age-restricted and premium content. Verification required."
          sticky
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
    <div className="space-y-6">
      <PageHeader
        title="Vault"
        description="Choose where your premium or restricted content should live."
        sticky
      />
      {platforms === null ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">Loading vault destinations...</CardContent>
        </Card>
      ) : platforms.length === 0 ? (
        <EmptyState
          icon={<Archive className="h-6 w-6" />}
          title="No vault destinations yet"
          description="Connect platforms or create content in Studio to see vault destinations here."
          action={
            <Button asChild size="sm">
              <Link href="/studio">Go to Studio</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Vault Destinations</CardTitle>
            <CardDescription>Platforms available for your vault content.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {platforms.map((platform) => (
              <div key={platform.id} className="rounded-md border px-3 py-2 text-sm">
                {platform.name}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
