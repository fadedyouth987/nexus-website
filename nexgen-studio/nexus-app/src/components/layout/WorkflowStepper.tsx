'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/core/utils'
import { APP_NAVIGATION, WORKFLOW_PHASES, type NavItem } from '@/lib/navigation'

// Build phase prefixes dynamically from navigation structure
function getPhasePrefixes(phaseNumber: number): string[] {
  const prefixes: string[] = []

  // Find all nav items belonging to this phase
  APP_NAVIGATION.forEach((section) => {
    const sectionPhase = section.phase
    section.items.forEach((item) => {
      const itemPhase = item.phase ?? sectionPhase
      if (itemPhase === phaseNumber) {
        prefixes.push(item.href)
      }
    })
  })

  // Add legacy/alias paths
  const phase = WORKFLOW_PHASES.find((p) => p.id === phaseNumber)
  if (phaseNumber === 1) {
    prefixes.push('/templates', '/brand-kits', '/influencers')
  }
  if (phaseNumber === 2) {
    prefixes.push('/edit', '/design', '/video-jobs', '/production')
  }
  if (phaseNumber === 3) {
    prefixes.push('/assets')
  }
  if (phaseNumber === 4) {
    prefixes.push('/planner', '/projects', '/campaigns', '/schedules')
  }
  if (phaseNumber === 5) {
    prefixes.push('/social', '/posts')
  }
  if (phaseNumber === 6) {
    prefixes.push('/organizations')
  }

  return [...new Set(prefixes)].sort((a, b) => b.length - a.length)
}

function getActivePhase(pathname: string): number | null {
  for (const phase of WORKFLOW_PHASES) {
    const prefixes = getPhasePrefixes(phase.id)
    if (prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      return phase.id
    }
  }
  return null
}

export function WorkflowStepper() {
  const pathname = usePathname()
  const activePhase = getActivePhase(pathname)

  return (
    <div className="flex items-center gap-1">
      {WORKFLOW_PHASES.map((phase, idx) => {
        const isActive = phase.id === activePhase
        const isPast = activePhase != null && phase.id < activePhase
        return (
          <div key={phase.id} className="flex items-center gap-1">
            <Link
              href={phase.href}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all',
                isActive
                  ? 'bg-primary/15 text-primary'
                  : isPast
                    ? 'text-muted-foreground/80 hover:text-foreground'
                    : 'text-muted-foreground/50 hover:text-muted-foreground'
              )}
            >
              <span
                className={cn(
                  'flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : isPast
                      ? 'bg-muted-foreground/20 text-muted-foreground'
                      : 'bg-muted-foreground/10 text-muted-foreground/60'
                )}
              >
                {phase.id}
              </span>
              <span className="hidden sm:inline">{phase.label}</span>
            </Link>
            {idx < PHASES.length - 1 && (
              <div
                className={cn(
                  'h-px w-3',
                  isPast ? 'bg-muted-foreground/30' : 'bg-muted-foreground/10'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
