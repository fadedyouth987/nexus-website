import Link from 'next/link'
import { ArrowRight, BriefcaseBusiness, Clapperboard, FolderKanban, Palette, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

const overviewCards: Array<{
  title: string
  description: string
  href: string
  icon: LucideIcon
}> = [
  {
    title: 'Projects',
    description: 'Tenant-safe containers for client work, launch streams, and internal content systems.',
    href: '/projects',
    icon: FolderKanban,
  },
  {
    title: 'Brand Kits',
    description: 'Centralize palette, tone, voice, and positioning so generation stays on-brand across every campaign.',
    href: '/brand-kits',
    icon: Palette,
  },
  {
    title: 'Campaigns',
    description: 'Turn strategy into executable briefs, channels, and production-ready content requests.',
    href: '/campaigns',
    icon: BriefcaseBusiness,
  },
  {
    title: 'Generation Jobs',
    description: 'Track durable image and video work with queued, active, completed, cancelled, and failed lifecycle states.',
    href: '/video-jobs',
    icon: Clapperboard,
  },
]

export function SaaSOverviewGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
      {overviewCards.map((card) => {
        const Icon = card.icon
        return (
          <Link key={card.href} href={card.href}>
            <Card className="h-full border-border/70 bg-card/80 transition-all hover:-translate-y-0.5 hover:shadow-lg">
              <CardContent className="p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-base font-semibold tracking-tight text-foreground">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{card.description}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
                  Open
                  <ArrowRight className="h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
