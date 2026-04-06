import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type NextStepBannerProps = {
  currentPhase: number
  nextLabel: string
  nextHref: string
  nextIcon?: LucideIcon
}

export function NextStepBanner({ currentPhase, nextLabel, nextHref, nextIcon: Icon }: NextStepBannerProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
          {currentPhase}
        </span>
        <span className="text-sm text-muted-foreground">
          Ready for the next step?
        </span>
      </div>
      <Button asChild size="sm" className="gap-2">
        <Link href={nextHref}>
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          {nextLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  )
}
