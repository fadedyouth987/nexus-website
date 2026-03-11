'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import apiFetch from '@/lib/core/api'

type Version = {
  id: string
  version_number: number
  change_summary: string | null
  created_by: string
  created_at: string
}

type VersionHistoryProps = {
  planId: string | null
}

export function VersionHistory({ planId }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([])

  useEffect(() => {
    if (!planId) {
      return
    }

    let cancelled = false
    void apiFetch(`/plans/${planId}/versions`)
      .then((res) => res.json())
      .then((data: { versions?: Version[] }) => {
        if (!cancelled) {
          setVersions(data.versions ?? [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVersions([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [planId])

  if (!planId || versions.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base text-foreground">Version history</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          {versions.slice(0, 5).map((v) => (
            <li key={v.id} className="rounded border border-border bg-muted/20 px-2 py-1">
              <span className="font-medium text-foreground">v{v.version_number}</span>
              {v.change_summary && (
                <span className="ml-2 text-muted-foreground">{v.change_summary}</span>
              )}
              <span className="ml-2 text-xs text-muted-foreground">{v.created_by}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
