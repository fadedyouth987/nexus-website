'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import apiFetch from '@/lib/core/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

type OrgResponse = {
  id: string
  name: string
  role: string
}

export default function OrganizationSettingsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [org, setOrg] = useState<OrgResponse | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }

    if (status === 'authenticated') {
      void loadOrg()
    }
  }, [status, router])

  const loadOrg = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch('/org')
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load organization')
      }
      setOrg((await response.json()) as OrgResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load organization')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization"
        description="Manage the organization profile resolved from the tenancy-aware session and organization membership lookup."
        breadcrumb={[
          { label: 'Settings', href: '/settings' },
          { label: 'Organization' },
        ]}
      />

      {error ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-4">
            <div className="app-callout app-callout-danger text-sm">{error}</div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Organization Profile</CardTitle>
          <CardDescription>Resolved from `org_members_v2` and server-side session checks.</CardDescription>
        </CardHeader>
        <CardContent className="app-form-stack text-sm text-foreground">
          <div className="app-callout app-callout-neutral">Name: {org?.name || 'N/A'}</div>
          <div className="app-callout app-callout-neutral">Organization ID: {org?.id || 'N/A'}</div>
          <div className="app-callout app-callout-neutral capitalize">Your Role: {org?.role || 'N/A'}</div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/billing">Open billing</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/team">Open team</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
