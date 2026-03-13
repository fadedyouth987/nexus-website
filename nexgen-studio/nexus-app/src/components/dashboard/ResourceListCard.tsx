import Link from 'next/link'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type ResourceItem = {
  id: string
  title: string
  description: string
  meta?: string
  href?: string
  editHref?: string
}

export function ResourceListCard({
  eyebrow,
  title,
  description,
  icon: Icon,
  actionHref,
  actionLabel,
  items,
}: {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
  actionHref: string
  actionLabel: string
  items: ResourceItem[]
}) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
              <Icon className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <Button asChild className="shrink-0 gap-2">
            <Link href={actionHref}>
              {actionLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-6 grid gap-3">
          {items.length > 0 ? (
            items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight text-foreground">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                    {item.href || item.editHref ? (
                      <div className="mt-3 flex gap-3 text-xs">
                        {item.href ? <Link href={item.href} className="font-medium text-primary">Open</Link> : null}
                        {item.editHref ? <Link href={item.editHref} className="font-medium text-muted-foreground hover:text-foreground">Edit</Link> : null}
                      </div>
                    ) : null}
                  </div>
                  {item.meta ? (
                    <span className="rounded-full border border-border/70 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {item.meta}
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-sm text-muted-foreground">
              No records yet. The new module and API are in place, so this page will populate once you start creating items through the app or API.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
