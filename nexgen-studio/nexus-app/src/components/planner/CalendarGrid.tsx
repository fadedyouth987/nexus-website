'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type ContentItem = {
  id?: string
  day_number: number
  platform?: string
  content_pillar?: string
  funnel_stage?: string
  hook?: string
  angle?: string
  cta?: string
  status?: string
  publish_date?: string
}

type CalendarGridProps = {
  items: ContentItem[]
  planId: string | null
  onRegenerateRange?: (fromDay: number, toDay: number, instruction: string) => Promise<void>
  loading?: boolean
}

export function CalendarGrid({
  items,
  planId,
  onRegenerateRange,
  loading,
}: CalendarGridProps) {
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [weekFilter, setWeekFilter] = useState<string>('all')
  const [regenerating, setRegenerating] = useState(false)
  const [regenerateRange, setRegenerateRange] = useState({ from: 8, to: 14, instruction: 'Make this week more viral' })

  const filtered = items.filter((it) => {
    if (platformFilter !== 'all' && it.platform !== platformFilter) return false
    if (weekFilter !== 'all') {
      const w = parseInt(weekFilter, 10)
      const minDay = (w - 1) * 7 + 1
      const maxDay = w * 7
      if (it.day_number < minDay || it.day_number > maxDay) return false
    }
    return true
  })

  const platforms = Array.from(new Set(items.map((i) => i.platform).filter(Boolean))) as string[]

  const handleRegenerate = async () => {
    if (!planId || !onRegenerateRange) return
    setRegenerating(true)
    try {
      await onRegenerateRange(regenerateRange.from, regenerateRange.to, regenerateRange.instruction)
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base text-foreground">Content calendar</CardTitle>
        <div className="flex gap-2">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p ?? 'unknown'}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={weekFilter} onValueChange={setWeekFilter}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Week" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All weeks</SelectItem>
              {[1, 2, 3, 4].map((w) => (
                <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {onRegenerateRange && planId && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
            <span className="text-xs text-muted-foreground">Regenerate:</span>
            <input
              type="number"
              min={1}
              max={30}
              value={regenerateRange.from}
              onChange={(e) => setRegenerateRange((r) => ({ ...r, from: parseInt(e.target.value, 10) || 1 }))}
              className="w-12 rounded border border-input bg-background px-1 py-0.5 text-xs text-foreground"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <input
              type="number"
              min={1}
              max={30}
              value={regenerateRange.to}
              onChange={(e) => setRegenerateRange((r) => ({ ...r, to: parseInt(e.target.value, 10) || 1 }))}
              className="w-12 rounded border border-input bg-background px-1 py-0.5 text-xs text-foreground"
            />
            <input
              type="text"
              placeholder="Instruction"
              value={regenerateRange.instruction}
              onChange={(e) => setRegenerateRange((r) => ({ ...r, instruction: e.target.value }))}
              className="min-w-[140px] flex-1 rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
            />
            <Button size="sm" variant="secondary" onClick={handleRegenerate} disabled={regenerating || loading}>
              {regenerating ? 'Regenerating…' : 'Regenerate'}
            </Button>
          </div>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading calendar…</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No content items yet. Describe your plan in the chat to generate a content calendar.</p>
        ) : (
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {filtered.map((it, i) => (
              <div
                key={it.id ?? i}
                className="rounded-md border border-border bg-muted/20 p-2 text-sm"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">Day {it.day_number}</Badge>
                  {it.platform && <Badge variant="secondary">{it.platform}</Badge>}
                  {it.funnel_stage && <span className="text-muted-foreground">{it.funnel_stage}</span>}
                </div>
                {it.hook && <p className="mt-1 font-medium text-foreground">{it.hook}</p>}
                {it.angle && <p className="text-xs text-muted-foreground">{it.angle}</p>}
                {it.cta && <p className="text-xs text-muted-foreground mt-0.5">CTA: {it.cta}</p>}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
