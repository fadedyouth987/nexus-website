'use client'

import Link from 'next/link'
import { Clock } from 'lucide-react'

interface RecentRunsRailProps {
  lastJobId: string | null
}

export function RecentRunsRail({ lastJobId }: RecentRunsRailProps) {
  if (!lastJobId) return null

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Recent Runs</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link href={`/generations/${lastJobId}`}>
          <div className="app-shell-panel-muted p-3 flex items-start gap-3 transition-all hover:bg-surface-interactive hover:border-primary/30 cursor-pointer shadow-sm hover:shadow-md group">
            <div className="w-8 h-8 rounded bg-background border border-border/80 flex items-center justify-center shrink-0 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
              <Clock className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate mt-0.5">Job: {lastJobId.slice(0, 8)}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/80 animate-pulse"></span>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
