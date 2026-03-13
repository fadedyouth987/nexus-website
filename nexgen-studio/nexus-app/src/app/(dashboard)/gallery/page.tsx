'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Calendar, Download, ExternalLink, Images, Share2, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useWorkspace } from '@/context/WorkspaceContext'
import apiFetch from '@/lib/core/api'
import { AppHero } from '@/components/layout/AppHero'
import { NextStepBanner } from '@/components/layout/NextStepBanner'

type Asset = {
  id: string
  influencer_id?: string
  type?: string
  sfw_status?: string
  thumbnail_path?: string
  storage_path?: string
  meta?: Record<string, unknown>
  created_at?: string
}

type FilterType = 'all' | 'image' | 'video'

export default function GalleryPage() {
  const { currentWorkspace } = useWorkspace()
  const [assets, setAssets] = useState<Asset[]>([])
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<FilterType>('all')
  const [influencerFilter, setInfluencerFilter] = useState<string>('all')
  const [lightboxAsset, setLightboxAsset] = useState<Asset | null>(null)
  const [copySuccess, setCopySuccess] = useState<string | null>(null)

  const handleCopyLink = async (asset: Asset) => {
    if (!asset.storage_path) return
    try {
      await navigator.clipboard.writeText(asset.storage_path)
      setCopySuccess(asset.id)
      setTimeout(() => setCopySuccess(null), 2000)
    } catch {
      // ignore clipboard failures
    }
  }

  const influencerIds = useMemo(() => {
    const ids = new Set<string>()
    assets.forEach((asset) => {
      if (asset.influencer_id) ids.add(asset.influencer_id)
    })
    return Array.from(ids).sort()
  }, [assets])

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      if (typeFilter === 'image' && asset.type?.toUpperCase() !== 'IMAGE' && asset.type !== 'image') return false
      if (typeFilter === 'video' && asset.type?.toUpperCase() !== 'VIDEO' && asset.type !== 'video') return false
      if (influencerFilter !== 'all' && asset.influencer_id !== influencerFilter) return false
      return true
    })
  }, [assets, typeFilter, influencerFilter])

  useEffect(() => {
    if (!currentWorkspace?.id) {
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async () => {
      try {
        const res = await apiFetch(`/workspaces/${currentWorkspace.id}/assets`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as Asset[] | { items?: Asset[] }
        const list = Array.isArray(data) ? data : (data?.items ?? [])
        const sfwOnly = list.filter(
          (asset) => asset.sfw_status === 'sfw' || asset.sfw_status === 'SFW' || !asset.sfw_status
        )
        if (!cancelled) {
          setAssets(sfwOnly)
          const urls: Record<string, string> = {}
          const urlResults = await Promise.allSettled(
            sfwOnly.slice(0, 50).map(async (a) => {
              const r = await apiFetch(`/assets/${a.id}/signed-url`)
              if (!r.ok) return null
              const d = (await r.json()) as { signedUrl?: string }
              return d.signedUrl ? { id: a.id, url: d.signedUrl } : null
            })
          )
          for (const r of urlResults) {
            if (r.status === 'fulfilled' && r.value) urls[r.value.id] = r.value.url
          }
          if (!cancelled) setSignedUrls(urls)
        }
      } catch {
        if (!cancelled) setAssets([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [currentWorkspace?.id])

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Gallery"
        title="Review your approved asset library"
        description="Browse finished SFW images and videos from the workspace, open full-size previews, and route assets into the next step of the content system."
        actions={
          <Button asChild size="lg">
            <Link href="/studio">Create in Studio</Link>
          </Button>
        }
        metrics={[
          { label: 'Workspace', value: currentWorkspace?.name || 'Unselected' },
          { label: 'Assets', value: assets.length },
          { label: 'Filtered', value: filteredAssets.length },
        ]}
        media={
          <Image
            src="/app/gallery-lightbox.svg"
            alt="Gallery library artwork"
            width={1400}
            height={980}
            className="h-auto w-full rounded-[24px]"
          />
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="aspect-square animate-pulse rounded-[24px] bg-muted/50" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={<Images className="h-6 w-6" />}
          title="No SFW content yet"
          description="Create images and videos in Studio. They will show here automatically. For age-restricted content, use Vault after verification."
          action={
            <Button asChild>
              <Link href="/studio">Go to Studio</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="app-shell-panel-muted flex flex-wrap items-center gap-3 px-4 py-4">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Type</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as FilterType)}
              className="rounded-full border border-input bg-background px-3 py-1.5 text-xs"
            >
              <option value="all">All</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            {influencerIds.length > 0 ? (
              <>
                <span className="ml-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Creator</span>
                <select
                  value={influencerFilter}
                  onChange={(e) => setInfluencerFilter(e.target.value)}
                  className="rounded-full border border-input bg-background px-3 py-1.5 text-xs"
                >
                  <option value="all">All</option>
                  {influencerIds.map((id) => (
                    <option key={id} value={id}>
                      Creator {id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredAssets.map((asset) => (
              <Card key={asset.id} className="overflow-hidden">
                <div className="aspect-square bg-muted/30 flex items-center justify-center relative">
                  {(signedUrls[asset.id] || asset.thumbnail_path) ? (
                    <img
                      src={signedUrls[asset.id] || asset.thumbnail_path || ''}
                      alt=""
                      className="h-full w-full cursor-pointer object-cover"
                      onClick={() => setLightboxAsset(asset)}
                    />
                  ) : (
                    <Images className="h-10 w-10 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs text-muted-foreground">
                      {asset.type === 'VIDEO' || asset.type === 'video' ? (
                        <span className="inline-flex items-center gap-1">
                          <Video className="h-3 w-3" /> Video
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Images className="h-3 w-3" /> Image
                        </span>
                      )}
                    </p>
                    <div className="flex gap-0.5 shrink-0">
                      {(signedUrls[asset.id] || asset.storage_path) ? (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="View full size" asChild>
                            <a href={signedUrls[asset.id] || asset.storage_path || ''} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Download" asChild>
                            <a href={signedUrls[asset.id] || asset.storage_path || ''} download target="_blank" rel="noopener noreferrer">
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={copySuccess === asset.id ? 'Copied' : 'Copy link'}
                          onClick={() => handleCopyLink(asset)}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                        </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" className="flex-1 text-[11px] h-7" asChild>
                      <Link href={`/edit?assetId=${asset.id}`}>Edit</Link>
                    </Button>
                    <Button size="sm" variant="ghost" className="flex-1 text-[11px] h-7" asChild>
                      <Link href="/automation/planner">Schedule</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {lightboxAsset && (signedUrls[lightboxAsset.id] || lightboxAsset.storage_path) ? (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setLightboxAsset(null)}
              role="dialog"
              aria-modal="true"
              aria-label="View full size"
            >
              <img
                src={signedUrls[lightboxAsset.id] || lightboxAsset.storage_path || ''}
                alt=""
                className="max-h-full max-w-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          ) : null}
        </>
      )}

      <NextStepBanner currentPhase={3} nextLabel="Schedule your content" nextHref="/calendar" nextIcon={Calendar} />
    </div>
  )
}
