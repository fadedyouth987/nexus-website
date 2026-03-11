import type { ReactNode } from 'react'
import { cn } from '@/lib/core/utils'

type HeroMetric = {
  label: string
  value: ReactNode
}

type AppHeroProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  metrics?: HeroMetric[]
  media?: ReactNode
  className?: string
}

export function AppHero({
  eyebrow,
  title,
  description,
  actions,
  metrics,
  media,
  className,
}: AppHeroProps) {
  return (
    <section className={cn('app-hero-shell', className)} suppressHydrationWarning>
      <div className="app-hero-grid">
        <div className="space-y-6">
          {eyebrow ? <div className="app-chip">{eyebrow}</div> : null}
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            {description ? (
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          {metrics?.length ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.label} className="app-metric-card">
                  <div className="text-2xl font-semibold tracking-tight text-foreground">
                    {metric.value}
                  </div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {metric.label}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        {media ? <div className="app-media-frame">{media}</div> : null}
      </div>
    </section>
  )
}
