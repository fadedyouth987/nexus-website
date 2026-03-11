'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import type { SeriesInfluencer } from './types'

type SeriesCreatePayload = {
  influencerId: string
  title: string
  theme: string
  episodeCount: number
}

export function SeriesCreateForm({
  influencers,
  loading,
  onCreate,
}: {
  influencers: SeriesInfluencer[]
  loading: boolean
  onCreate: (payload: SeriesCreatePayload) => Promise<void>
}) {
  const [influencerId, setInfluencerId] = useState('')
  const [title, setTitle] = useState('')
  const [theme, setTheme] = useState('')
  const [episodeCount, setEpisodeCount] = useState('8')

  const canSubmit = useMemo(() => {
    return Boolean(influencerId && title.trim() && theme.trim() && Number(episodeCount) > 0)
  }, [influencerId, title, theme, episodeCount])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Series Engine</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Influencer</label>
          <Select value={influencerId || undefined} onValueChange={setInfluencerId}>
            <SelectTrigger>
              <SelectValue placeholder="Select influencer" />
            </SelectTrigger>
            <SelectContent>
              {influencers.map((influencer) => (
                <SelectItem key={influencer.id} value={influencer.id}>
                  {influencer.name || influencer.display_name || influencer.handle || influencer.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Series Title</label>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. 8 Days to Launch" />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Theme</label>
          <Textarea
            value={theme}
            onChange={(event) => setTheme(event.target.value)}
            placeholder="Define the creative narrative and visual style."
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Episodes</label>
          <Input
            type="number"
            min={1}
            max={100}
            value={episodeCount}
            onChange={(event) => setEpisodeCount(event.target.value)}
          />
        </div>

        <Button
          disabled={!canSubmit || loading}
          onClick={() =>
            onCreate({
              influencerId,
              title: title.trim(),
              theme: theme.trim(),
              episodeCount: Math.max(1, Math.min(100, Number(episodeCount) || 1)),
            })
          }
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </span>
          ) : (
            'Create Series'
          )}
        </Button>
      </CardContent>
    </Card>
  )
}
