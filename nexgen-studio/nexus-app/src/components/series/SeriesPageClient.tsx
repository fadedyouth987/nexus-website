'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import apiFetch from '@/lib/core/api'
import { useWorkspace } from '@/context/WorkspaceContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SeriesCreateForm } from './SeriesCreateForm'
import { SeriesEpisodeList } from './SeriesEpisodeList'
import type { SeriesEpisode, SeriesInfluencer, SeriesProject } from './types'

export function SeriesPageClient({
  initialInfluencers,
  initialSeries,
  initialEpisodes,
  workspaceId,
}: {
  initialInfluencers: SeriesInfluencer[]
  initialSeries: SeriesProject[]
  initialEpisodes: SeriesEpisode[]
  workspaceId: string | null
}) {
  const { currentWorkspace } = useWorkspace()
  const [seriesList, setSeriesList] = useState<SeriesProject[]>(initialSeries)
  const [episodes, setEpisodes] = useState<SeriesEpisode[]>(initialEpisodes)
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(initialSeries[0]?.id || '')
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(initialEpisodes[0]?.id || null)
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})
  const [isCreating, setIsCreating] = useState(false)
  const [isRegeneratingSeries, setIsRegeneratingSeries] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const visibleEpisodes = useMemo(
    () => episodes.filter((episode) => episode.series_id === selectedSeriesId),
    [episodes, selectedSeriesId]
  )

  const selectedEpisode = useMemo(
    () => visibleEpisodes.find((episode) => episode.id === selectedEpisodeId) || null,
    [visibleEpisodes, selectedEpisodeId]
  )

  const refreshSeries = useCallback(async () => {
    const query = currentWorkspace?.id ? `?workspaceId=${currentWorkspace.id}` : ''
    const response = await apiFetch(`/series${query}`)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return
    }

    const items = Array.isArray((payload as { items?: unknown[] }).items)
      ? ((payload as { items: SeriesProject[] }).items)
      : []

    setSeriesList(items)
    if (!selectedSeriesId && items[0]?.id) {
      setSelectedSeriesId(items[0].id)
    }
  }, [currentWorkspace?.id, selectedSeriesId])

  const refreshEpisodes = useCallback(async () => {
    if (!selectedSeriesId) return
    const response = await apiFetch(`/series/${selectedSeriesId}/episodes`)
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      return
    }

    const items = Array.isArray((payload as { items?: unknown[] }).items)
      ? ((payload as { items: SeriesEpisode[] }).items)
      : []

    setEpisodes((prev) => {
      const withoutCurrent = prev.filter((episode) => episode.series_id !== selectedSeriesId)
      return [...withoutCurrent, ...items]
    })
    if (items[0] && !selectedEpisodeId) {
      setSelectedEpisodeId(items[0].id)
    }
  }, [selectedEpisodeId, selectedSeriesId])

  const resolveSignedUrl = useCallback(async (assetId: string) => {
    if (!assetId || assetUrls[assetId]) return
    const response = await apiFetch(`/assets/${assetId}/signed-url`)
    if (!response.ok) return
    const payload = (await response.json()) as { signedUrl?: string }
    if (!payload.signedUrl) return
    setAssetUrls((prev) => ({ ...prev, [assetId]: payload.signedUrl! }))
  }, [assetUrls])

  useEffect(() => {
    if (selectedEpisode?.generated_asset_id) {
      void resolveSignedUrl(selectedEpisode.generated_asset_id)
    }
  }, [resolveSignedUrl, selectedEpisode?.generated_asset_id])

  useEffect(() => {
    if (!selectedSeriesId) return
    void refreshEpisodes()
    const timer = setInterval(() => {
      void refreshEpisodes()
    }, 5000)
    return () => clearInterval(timer)
  }, [refreshEpisodes, selectedSeriesId])

  useEffect(() => {
    const timer = setInterval(() => {
      void refreshSeries()
    }, 5000)
    return () => clearInterval(timer)
  }, [refreshSeries])

  const handleCreateSeries = useCallback(
    async (payload: { influencerId: string; title: string; theme: string; episodeCount: number }) => {
      setIsCreating(true)
      setError(null)
      try {
        const response = await apiFetch('/series', {
          method: 'POST',
          body: JSON.stringify({
            influencerId: payload.influencerId,
            title: payload.title,
            theme: payload.theme,
            episodeCount: payload.episodeCount,
            workspaceId: currentWorkspace?.id || workspaceId,
          }),
        })
        const json = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(json.detail || 'Failed to create series')
        }
        if (typeof json.seriesId === 'string') {
          setSelectedSeriesId(json.seriesId)
        }
        await refreshSeries()
        await refreshEpisodes()
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : 'Failed to create series')
      } finally {
        setIsCreating(false)
      }
    },
    [currentWorkspace?.id, refreshEpisodes, refreshSeries, workspaceId]
  )

  const handleRegenerateEpisode = useCallback(
    async (episodeId: string) => {
      if (!selectedSeriesId) return
      const response = await apiFetch(`/series/${selectedSeriesId}/episodes/${episodeId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.detail || 'Failed to regenerate episode')
        return
      }
      await refreshEpisodes()
    },
    [refreshEpisodes, selectedSeriesId]
  )

  const handleAddEpisode = useCallback(async () => {
    if (!selectedSeriesId) return
    const response = await apiFetch(`/series/${selectedSeriesId}/episodes`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      setError(payload.detail || 'Failed to add episode')
      return
    }
    await refreshSeries()
    await refreshEpisodes()
  }, [refreshEpisodes, refreshSeries, selectedSeriesId])

  const handleRegenerateSeries = useCallback(async () => {
    if (!selectedSeriesId) return
    setIsRegeneratingSeries(true)
    setError(null)

    try {
      const response = await apiFetch(`/series/${selectedSeriesId}/regenerate`, {
        method: 'POST',
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to regenerate series')
      }

      await refreshSeries()
      await refreshEpisodes()
    } catch (regenerateError) {
      setError(regenerateError instanceof Error ? regenerateError.message : 'Failed to regenerate series')
    } finally {
      setIsRegeneratingSeries(false)
    }
  }, [refreshEpisodes, refreshSeries, selectedSeriesId])

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <SeriesCreateForm influencers={initialInfluencers} loading={isCreating} onCreate={handleCreateSeries} />

      <Card>
        <CardHeader>
          <CardTitle>Series Episodes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Select value={selectedSeriesId || undefined} onValueChange={setSelectedSeriesId}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select series" />
              </SelectTrigger>
              <SelectContent>
                {seriesList.map((series) => (
                  <SelectItem key={series.id} value={series.id}>
                    {series.title} ({series.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => void handleRegenerateSeries()}
                disabled={!selectedSeriesId || isRegeneratingSeries}
              >
                {isRegeneratingSeries ? 'Regenerating...' : 'Regenerate Series'}
              </Button>
              <Button variant="outline" onClick={() => void handleAddEpisode()} disabled={!selectedSeriesId}>
                Add New Episode
              </Button>
            </div>
          </div>

          <SeriesEpisodeList
            episodes={visibleEpisodes}
            selectedEpisodeId={selectedEpisodeId}
            onSelectEpisode={setSelectedEpisodeId}
            onRegenerateEpisode={handleRegenerateEpisode}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Episode Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedEpisode ? (
            <p className="text-sm text-muted-foreground">Select an episode to preview.</p>
          ) : (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">Episode {selectedEpisode.episode_index}: </span>
                {selectedEpisode.title || 'Untitled'}
              </div>
              {selectedEpisode.generated_asset_id && assetUrls[selectedEpisode.generated_asset_id] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={assetUrls[selectedEpisode.generated_asset_id]}
                  alt={selectedEpisode.title || 'Episode thumbnail'}
                  className="max-h-80 rounded border"
                />
              ) : (
                <div className="h-56 rounded border bg-muted flex items-center justify-center text-sm text-muted-foreground">
                  Thumbnail unavailable
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
