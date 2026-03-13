'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type DrawerProps = {
  verificationLevel: number
  modelCount: number
}

export function StudioRightDrawer({ verificationLevel, modelCount }: DrawerProps) {
  const levelLabel = useMemo(() => {
    if (verificationLevel >= 2) return 'Level 2'
    if (verificationLevel >= 1) return 'Level 1'
    return 'Unverified'
  }, [verificationLevel])

  return (
    <aside className="w-80 border-l border-border bg-card p-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Verification</span>
            <Badge variant="secondary">{levelLabel}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Models</span>
            <span>{modelCount}</span>
          </div>
          <div className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
            Explicit NSFW requires Level 2 verification and human moderation review.
          </div>
        </CardContent>
      </Card>
    </aside>
  )
}
