'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export type PlanItemRow = {
  id: string
  day_index: number
  status: string
  queue_job_id: string | null
}

function shortJobId(jobId: string | null) {
  if (!jobId) return 'n/a'
  return jobId.length > 12 ? `${jobId.slice(0, 12)}...` : jobId
}

function badgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'READY') return 'default'
  if (status === 'FAILED') return 'destructive'
  if (status === 'QUEUED' || status === 'GENERATING') return 'secondary'
  return 'outline'
}

export function PlanItemsGrid({ items }: { items: PlanItemRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Day</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Job ID</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.day_index}</TableCell>
            <TableCell>
              <Badge variant={badgeVariant(item.status)}>{item.status}</Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">{shortJobId(item.queue_job_id)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
