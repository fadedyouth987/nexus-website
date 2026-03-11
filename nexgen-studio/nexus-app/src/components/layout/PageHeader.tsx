import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/core/utils'

type PageHeaderProps = {
  title: string
  description?: string
  breadcrumb?: { label: string; href?: string }[]
  actions?: ReactNode
  sticky?: boolean
}

export function PageHeader({ title, description, breadcrumb, actions, sticky }: PageHeaderProps) {
  if (sticky) {
    return (
      <div
        className={cn(
          'sticky top-3 z-20 -mx-[var(--content-padding)] px-[var(--content-padding)] pb-3'
        )}
      >
        <div className="app-shell-panel app-section-header px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    )
  }

  return (
    <div className="app-hero-shell">
      <div className="app-section-header">
        <div className="app-section-copy min-w-0">
          {breadcrumb && breadcrumb.length > 0 ? (
            <nav className="flex flex-wrap items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {breadcrumb.map((item, i) => (
                <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
                  {item.href ? (
                    <Link href={item.href} className="transition-colors hover:text-foreground">
                      {item.label}
                    </Link>
                  ) : (
                    <span>{item.label}</span>
                  )}
                  {i < breadcrumb.length - 1 ? <span aria-hidden>/</span> : null}
                </span>
              ))}
            </nav>
          ) : null}
          <div className="space-y-2">
            <h1 className="app-section-title text-3xl sm:text-4xl">{title}</h1>
            {description ? (
              <p className="app-section-description max-w-3xl">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
