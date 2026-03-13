'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/use-toast'
import apiFetch from '@/lib/core/api'
import { useWorkspace } from '@/context/WorkspaceContext'
import { Loader2 } from 'lucide-react'
import {
  canPublishContentToPlatform,
  normalizePlatformId,
} from '@/lib/social/platformPolicy'

type Influencer = {
  id: string
  name?: string | null
  display_name?: string | null
  nsfw_allowed?: boolean | null
}

type Asset = { id: string; storage_url?: string; kind?: string }
type SocialAccount = { id: string; provider: string; accountName: string }

export default function CreateScheduledPostPage() {
  const { currentWorkspace } = useWorkspace()
  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([])

  const [influencerId, setInfluencerId] = useState('')
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [accountId, setAccountId] = useState('')
  const [contentRating, setContentRating] = useState<'sfw' | 'nsfw'>('sfw')
  const [caption, setCaption] = useState('')
  const [publishDate, setPublishDate] = useState('')
  const [publishTime, setPublishTime] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const router = useRouter()
  const { toast } = useToast()

  const loadInitial = useCallback(async () => {
    if (!currentWorkspace?.id) return
    setLoadError(null)
    try {
      const [infRes, accRes] = await Promise.all([
        apiFetch(`/workspaces/${currentWorkspace.id}/influencers`),
        apiFetch('/social/accounts'),
      ])
      if (infRes.ok) {
        const data = (await infRes.json()) as Influencer[]
        const nextInfluencers = Array.isArray(data) ? data : []
        setInfluencers(nextInfluencers)
        if (!influencerId && nextInfluencers[0]) setInfluencerId(nextInfluencers[0].id)
      }
      if (accRes.ok) {
        const data = (await accRes.json()) as SocialAccount[]
        const nextAccounts = Array.isArray(data) ? data : []
        setSocialAccounts(nextAccounts)
        if (!accountId && nextAccounts[0]) setAccountId(nextAccounts[0].id)
      }
    } catch {
      setLoadError('Failed to load creators or social accounts')
    }
  }, [currentWorkspace?.id])

  useEffect(() => {
    void loadInitial()
  }, [loadInitial])

  useEffect(() => {
    if (!influencerId) {
      setAssets([])
      return
    }
    apiFetch(`/influencers/${influencerId}/assets`)
      .then((res) => {
        if (res.ok) return res.json()
        return []
      })
      .then((data: Asset[] | { items?: Asset[] }) => {
        const list = Array.isArray(data) ? data : data?.items ?? []
        setAssets(list)
      })
      .catch(() => setAssets([]))
  }, [influencerId])

  useEffect(() => {
    const selectedInfluencer = influencers.find((item) => item.id === influencerId)
    if (!selectedInfluencer) return
    setContentRating(selectedInfluencer.nsfw_allowed ? 'nsfw' : 'sfw')
  }, [influencerId, influencers])

  const handleAssetSelection = (assetId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedAssetIds((prev) => [...prev, assetId])
    } else {
      setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId))
    }
  }

  const selectedAccount = socialAccounts.find((item) => item.id === accountId) || null
  const selectedProvider = normalizePlatformId(selectedAccount?.provider || '')
  const publishBlocked =
    Boolean(selectedProvider) && !canPublishContentToPlatform(selectedProvider, contentRating)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId || !caption.trim()) {
      toast({
        title: 'Missing fields',
        description: 'Select a social account and enter a caption.',
        variant: 'destructive',
      })
      return
    }

    if (selectedProvider && !canPublishContentToPlatform(selectedProvider, contentRating)) {
      toast({
        title: 'Platform policy block',
        description: `${selectedAccount?.provider || selectedProvider} does not allow ${contentRating.toUpperCase()} posts.`,
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      let mediaUrls: string[] = []
      if (selectedAssetIds.length > 0) {
        const urlRes = await Promise.all(
          selectedAssetIds.map((id) => apiFetch(`/assets/${id}/signed-url`))
        )
        const urls = await Promise.all(
          urlRes.map(async (r) => {
            if (!r.ok) return null
            const o = (await r.json()) as { url?: string }
            return o?.url ?? null
          })
        )
        mediaUrls = urls.filter((u): u is string => Boolean(u))
      }

      const scheduledFor =
        publishDate && publishTime
          ? new Date(`${publishDate}T${publishTime}`).toISOString()
          : undefined

      const res = await apiFetch('/social/publish', {
        method: 'POST',
        body: JSON.stringify({
          accountId,
          caption: caption.trim(),
          mediaUrls,
          scheduledFor,
          contentRating,
        }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { detail?: string }
        throw new Error(err.detail || 'Failed to schedule post')
      }

      toast({
        title: scheduledFor ? 'Post scheduled' : 'Post published',
        description: scheduledFor
          ? 'Your post will be published at the scheduled time.'
          : 'Your post has been published.',
      })
      router.push('/calendar')
    } catch (error) {
      toast({
        title: 'Failed',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const filteredAssets = assets

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-foreground">Create scheduled post</h1>
      {loadError && <p className="text-sm text-destructive mb-4">{loadError}</p>}
      {!currentWorkspace?.id && (
        <p className="text-sm text-muted-foreground mb-4">Select a workspace to continue.</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="influencerId" className="text-foreground">Creator</Label>
          <Select
            value={influencerId}
            onValueChange={setInfluencerId}
            disabled={!influencers.length}
          >
            <SelectTrigger id="influencerId" className="text-foreground">
              <SelectValue placeholder="Select a creator" />
            </SelectTrigger>
            <SelectContent>
              {influencers.map((inf) => (
                <SelectItem key={inf.id} value={inf.id}>
                  {inf.display_name || inf.name || inf.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-foreground">Assets (optional)</Label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-border p-2 rounded bg-muted/30">
            {filteredAssets.length === 0 && (
              <p className="col-span-2 text-muted-foreground text-sm">
                No assets for this creator, or select a creator first.
              </p>
            )}
            {filteredAssets.map((asset) => (
              <div key={asset.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`asset-${asset.id}`}
                  checked={selectedAssetIds.includes(asset.id)}
                  onCheckedChange={(checked) => handleAssetSelection(asset.id, !!checked)}
                />
                <Label htmlFor={`asset-${asset.id}`} className="text-sm text-foreground">
                  {asset.kind || asset.id}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="accountId" className="text-foreground">Social account</Label>
          <Select
            value={accountId}
            onValueChange={setAccountId}
            required
            disabled={!socialAccounts.length}
          >
            <SelectTrigger id="accountId" className="text-foreground">
              <SelectValue placeholder="Select connected account" />
            </SelectTrigger>
            <SelectContent>
              {socialAccounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.provider})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!socialAccounts.length && (
            <p className="text-xs text-muted-foreground mt-1">
              <Link href="/dashboard/social" className="underline hover:text-foreground">Link an account in Socials</Link>
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="contentRating" className="text-foreground">Content rating</Label>
          <Select value={contentRating} onValueChange={(value) => setContentRating(value as 'sfw' | 'nsfw')}>
            <SelectTrigger id="contentRating" className="text-foreground">
              <SelectValue placeholder="Select content rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sfw">SFW</SelectItem>
              <SelectItem value="nsfw">NSFW (18+ gated)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            NSFW publishing requires age verification and NSFW gate enabled in settings.
          </p>
          {publishBlocked && (
            <p className="text-xs text-destructive mt-1">
              Selected platform does not support {contentRating.toUpperCase()} content.
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="caption" className="text-foreground">Caption</Label>
          <Textarea
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            required
            rows={5}
            className="text-foreground"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="publishDate" className="text-foreground">Publish date (optional)</Label>
            <Input
              id="publishDate"
              type="date"
              value={publishDate}
              onChange={(e) => setPublishDate(e.target.value)}
              className="text-foreground"
            />
          </div>
          <div>
            <Label htmlFor="publishTime" className="text-foreground">Publish time (optional)</Label>
            <Input
              id="publishTime"
              type="time"
              value={publishTime}
              onChange={(e) => setPublishTime(e.target.value)}
              className="text-foreground"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Leave date/time empty to publish immediately.
        </p>

        <Button type="submit" disabled={loading || !accountId || publishBlocked}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Scheduling...
            </>
          ) : (
            'Schedule post'
          )}
        </Button>
      </form>
    </div>
  )
}
