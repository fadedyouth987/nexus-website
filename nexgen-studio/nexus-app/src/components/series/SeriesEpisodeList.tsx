'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { SeriesEpisode } from './types'

function badgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'READY') return 'default'
  if (status === 'FAILED') return 'destructive'
  if (status === 'QUEUED' || status === 'GENERATING') return 'secondary'
  return 'outline'
}

export function SeriesEpisodeList({
  episodes,
  selectedEpisodeId,
  onSelectEpisode,
  onRegenerateEpisode,
}: {
  episodes: SeriesEpisode[]
  selectedEpisodeId: string | null
  onSelectEpisode: (episodeId: string) => void
  onRegenerateEpisode: (episodeId: string) => Promise<void>
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Episode</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Job</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {episodes.map((episode) => (
          <TableRow
            key={episode.id}
            data-state={selectedEpisodeId === episode.id ? 'selected' : undefined}
            onClick={() => onSelectEpisode(episode.id)}
            className="cursor-pointer"
          >
            <TableCell>{episode.episode_index}</TableCell>
            <TableCell>
              <Badge variant={badgeVariant(episode.status)}>{episode.status}</Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">
              {episode.queue_job_id ? `${episode.queue_job_id.slice(0, 10)}...` : 'n/a'}
            </TableCell>
            <TableCell>
              <Button
                size="sm"
                variant="outline"
                onClick={(event) => {
                  event.stopPropagation()
                  void onRegenerateEpisode(episode.id)
                }}
              >
                Regenerate
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
