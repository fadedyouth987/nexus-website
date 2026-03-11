'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { CreatorMetricsRow } from './types'

export function CreatorMetricsTable({ rows }: { rows: CreatorMetricsRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Creator</TableHead>
          <TableHead>Posts</TableHead>
          <TableHead>Assets</TableHead>
          <TableHead>Engagement</TableHead>
          <TableHead>Plans</TableHead>
          <TableHead>Completed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.creator_id}>
            <TableCell>{row.creator_name}</TableCell>
            <TableCell>{row.total_posts}</TableCell>
            <TableCell>{row.total_generated_assets}</TableCell>
            <TableCell>{row.engagement_total}</TableCell>
            <TableCell>{row.plan_count}</TableCell>
            <TableCell>{row.plan_completed_count}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
