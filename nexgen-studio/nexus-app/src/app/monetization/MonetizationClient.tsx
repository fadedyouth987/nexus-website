'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import apiFetch from '@/lib/core/api'

type Offer = {
  id: string
  name: string
  offerType: string
  contentRating: string
  platform: string | null
  priceCents: number
  currency: string
  status: 'draft' | 'active' | 'paused' | 'archived'
}

export default function MonetizationClient() {
  const [mode, setMode] = useState<'solo' | 'organization'>('solo')
  const [offers, setOffers] = useState<Offer[]>([])
  const [name, setName] = useState('')
  const [offerType, setOfferType] = useState('paid_shoutout')
  const [contentRating, setContentRating] = useState<'sfw' | 'nsfw'>('sfw')
  const [platform, setPlatform] = useState('instagram')
  const [price, setPrice] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadOffers = async () => {
    setError(null)
    const res = await apiFetch('/monetization/offers')
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}))
      setError(payload.detail || 'Failed to load offers')
      return
    }
    const data = (await res.json()) as { mode: 'solo' | 'organization'; offers: Offer[] }
    setMode(data.mode)
    setOffers(Array.isArray(data.offers) ? data.offers : [])
  }

  useEffect(() => {
    void loadOffers()
  }, [])

  const createOffer = async () => {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch('/monetization/offers', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          offerType,
          contentRating,
          platform,
          priceCents: Math.round(Number(price || '0') * 100),
          currency: 'usd',
          status: 'draft',
        }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to create offer')
      }
      setName('')
      setPrice('0')
      await loadOffers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create offer')
    } finally {
      setSaving(false)
    }
  }

  const setOfferStatus = async (id: string, status: Offer['status']) => {
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch('/monetization/offers', {
        method: 'PATCH',
        body: JSON.stringify({ id, status }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to update offer status')
      }
      await loadOffers()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update offer status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monetization"
        description="Connect revenue operations with what is currently available in the product."
      />
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Create paid offer</span>
              <Badge variant="secondary">{mode === 'organization' ? 'Enterprise mode' : 'Solo mode'}</Badge>
            </CardTitle>
            <CardDescription>
              Build monetization offers for solo creators or organization teams. Draft first, then activate.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Offer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={offerType}
              onChange={(e) => setOfferType(e.target.value)}
              disabled={saving}
            >
              <option value="paid_shoutout">Paid shoutout</option>
              <option value="affiliate">Affiliate campaign</option>
              <option value="subscription">Subscription access</option>
              <option value="custom">Custom offer</option>
            </select>
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={contentRating}
              onChange={(e) => setContentRating(e.target.value as 'sfw' | 'nsfw')}
              disabled={saving}
            >
              <option value="sfw">SFW</option>
              <option value="nsfw">NSFW</option>
            </select>
            <div className="flex gap-2">
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={saving}
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="x">X</option>
              </select>
              <input
                className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm"
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={saving}
                placeholder="USD"
              />
            </div>
            <Button onClick={() => void createOffer()} disabled={saving || !name.trim()}>
              Create
            </Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Offers</CardTitle>
            <CardDescription>Manage lifecycle from draft to active for paid customer delivery.</CardDescription>
          </CardHeader>
          <CardContent>
            {offers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No offers yet. Create your first paid offer above.</p>
            ) : (
              <div className="space-y-2">
                {offers.map((offer) => (
                  <div key={offer.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">{offer.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {offer.offerType} · {offer.platform || 'any'} · {offer.contentRating.toUpperCase()} · $
                          {(offer.priceCents / 100).toFixed(2)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{offer.status}</Badge>
                        <select
                          className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                          value={offer.status}
                          onChange={(e) => void setOfferStatus(offer.id, e.target.value as Offer['status'])}
                          disabled={saving}
                        >
                          <option value="draft">draft</option>
                          <option value="active">active</option>
                          <option value="paused">paused</option>
                          <option value="archived">archived</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Plans and billing</span>
              <Badge variant="secondary">Available</Badge>
            </CardTitle>
            <CardDescription>
              Manage subscription plans, usage, and payment methods from billing settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm">
              <Link href="/settings/billing">Open Billing</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Vault gating</span>
              <Badge variant="secondary">Available</Badge>
            </CardTitle>
            <CardDescription>
              NSFW access and gated content flows run through verification and Vault controls.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/verification">Age &amp; NSFW Settings</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/vault">Open Vault</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

