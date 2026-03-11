'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Edit, Loader2, Plus, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import apiFetch from '@/lib/core/api'
import { isPortfolioV2ClientEnabled } from '@/lib/core/featureFlags'
import { useWorkspace } from '@/context/WorkspaceContext'
import { AppHero } from '@/components/layout/AppHero'

interface Creator {
  id: string
  name: string
  handle: string
  niche: string
  bio: string
  vault_mode: 'sfw' | 'nsfw'
  status: string
  created_at: string
}

type CreatorV2 = {
  id: string
  name: string
  handle: string | null
  niche: string | null
  status: string
  created_at: string
}

type CreatorsV2Response = {
  items: CreatorV2[]
  meta: {
    org_id: string
    workspace_id: string
    workspace_name: string
    role: string
    client_visible: boolean
  }
}

function LoadingCreators() {
  return (
    <div className="space-y-[var(--section-gap)]">
      <div className="app-hero-shell space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-4 w-[30rem]" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-64 rounded-[24px]" />
        ))}
      </div>
    </div>
  )
}

function LegacyCreatorsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [creators, setCreators] = useState<Creator[]>([])
  const [loading, setLoading] = useState(true)
  const [vaultMode, setVaultMode] = useState<'sfw' | 'nsfw'>('sfw')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
    }

    if (session?.user?.vault_mode) {
      setVaultMode(session.user.vault_mode === 'nsfw' ? 'nsfw' : 'sfw')
    }
  }, [status, session, router])

  const fetchCreators = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiFetch(`/creators?vault_mode=${vaultMode}`)
      if (!response.ok) throw new Error('Failed to fetch creators')
      const data = await response.json()
      setCreators(data)
    } catch (err) {
      console.error('Error fetching creators:', err)
    } finally {
      setLoading(false)
    }
  }, [vaultMode])

  useEffect(() => {
    if (session?.user?.accessToken && vaultMode) {
      void fetchCreators()
    }
  }, [session?.user?.accessToken, vaultMode, fetchCreators])

  const handleDelete = async (creatorId: string) => {
    if (!confirm('Are you sure you want to delete this creator?')) return

    try {
      const response = await apiFetch(`/creators/${creatorId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Failed to delete creator')
      setCreators(creators.filter((creator) => creator.id !== creatorId))
    } catch (err) {
      console.error('Error deleting creator:', err)
    }
  }

  if (status === 'loading') return <LoadingCreators />

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-[260px] items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    )
  }

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Creators"
        title={vaultMode === 'nsfw' ? 'Your NSFW creator roster' : 'Your SFW creator roster'}
        description="Manage identity, positioning, and bios for every persona in the workspace. The new shell keeps creators visually aligned with studio, gallery, and automation."
        actions={
          <Button asChild size="lg" className="gap-2">
            <Link href="/creators/create">
              <Plus className="h-4 w-4" />
              Create creator
            </Link>
          </Button>
        }
        metrics={[
          { label: 'Mode', value: vaultMode.toUpperCase() },
          { label: 'Creators', value: creators.length },
          { label: 'Status', value: loading ? 'Syncing' : 'Live' },
        ]}
        media={
          <Image
            src="/app/creators-grid.svg"
            alt="Creators roster artwork"
            width={1400}
            height={980}
            className="h-auto w-full rounded-[24px]"
          />
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : creators.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No creators yet"
          description="Build your first creator identity to start generating content, planning series, and routing assets across the rest of the product."
          action={
            <Button asChild>
              <Link href="/creators/create">Create your first creator</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {creators.map((creator) => (
            <Card key={creator.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{creator.name}</CardTitle>
                    <CardDescription className="mt-2">{creator.handle}</CardDescription>
                  </div>
                  <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                    {creator.vault_mode.toUpperCase()}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Niche</p>
                  <p className="mt-1 font-medium text-foreground">{creator.niche || 'Unspecified'}</p>
                </div>
                {creator.bio ? (
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Bio</p>
                    <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">{creator.bio}</p>
                  </div>
                ) : null}
                <div className="flex gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1 gap-2">
                    <Link href={`/creators/${creator.id}/edit`}>
                      <Edit className="h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-2" onClick={() => void handleDelete(creator.id)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CreatorsV2Page() {
  const router = useRouter()
  const { status } = useSession()
  const { currentWorkspace } = useWorkspace()
  const [data, setData] = useState<CreatorsV2Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCreators = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const query = currentWorkspace?.id ? `?workspace_id=${currentWorkspace.id}` : ''
      const response = await apiFetch(`/creators${query}`)

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to fetch creators')
      }

      const payload = (await response.json()) as CreatorsV2Response
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch creators')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace?.id])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }

    if (status === 'authenticated') {
      void fetchCreators()
    }
  }, [status, router, fetchCreators])

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-[260px] items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    )
  }

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Creators v2"
        title="Tenancy-aware creator workspace"
        description="This list is powered by the v2 creator endpoint with org and workspace resolution handled in the API layer. The presentation now matches the rest of the app shell without changing the data contract."
        metrics={[
          { label: 'Workspace', value: data?.meta.workspace_name || currentWorkspace?.name || 'Unscoped' },
          { label: 'Role', value: data?.meta.role || 'Unknown' },
          { label: 'Creators', value: data?.items.length || 0 },
        ]}
        media={
          <Image
            src="/app/creators-grid.svg"
            alt="Creators v2 artwork"
            width={1400}
            height={980}
            className="h-auto w-full rounded-[24px]"
          />
        }
      />

      {error ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {!data?.items?.length ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No creators in this workspace"
          description="This view stays intentionally minimal while v2 tenancy, RLS, and backfill correctness are being validated."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((creator) => (
            <Card key={creator.id}>
              <CardHeader>
                <CardTitle>{creator.name}</CardTitle>
                <CardDescription className="mt-2">
                  {creator.handle || 'No handle assigned'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">Niche: {creator.niche || 'Unspecified'}</div>
                <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">Status: {creator.status}</div>
                <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                  Created: {new Date(creator.created_at).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CreatorsPage() {
  return isPortfolioV2ClientEnabled() ? <CreatorsV2Page /> : <LegacyCreatorsPage />
}
