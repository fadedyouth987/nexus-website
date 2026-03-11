'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/core/utils'

const PHASES = [
  { id: 1, label: 'Create', href: '/creators', prefixes: ['/creators', '/templates'] },
  { id: 2, label: 'Generate', href: '/studio', prefixes: ['/studio', '/edit', '/design'] },
  { id: 3, label: 'Content', href: '/gallery', prefixes: ['/gallery', '/vault', '/production'] },
  { id: 4, label: 'Automate', href: '/automation', prefixes: ['/automation', '/planner'] },
  { id: 5, label: 'Publish', href: '/calendar', prefixes: ['/calendar', '/socials', '/inbox'] },
  { id: 6, label: 'Grow', href: '/analytics', prefixes: ['/analytics', '/monetization', '/agency'] },
] as const

function getActivePhase(pathname: string): number | null {
  for (const phase of PHASES) {
    if (phase.prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
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
      {PHASES.map((phase, idx) => {
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
