'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Building,
  BriefcaseBusiness,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  Palette,
  Settings,
  Clapperboard,
  Image,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/core/utils'
import { Button } from '@/components/ui/button'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const homeNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

const workflowNavItems: NavItem[] = [
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/brand-kits', label: 'Brand Kits', icon: Palette },
  { href: '/campaigns', label: 'Campaigns', icon: BriefcaseBusiness },
  { href: '/schedules', label: 'Schedules', icon: CalendarClock },
  { href: '/video-jobs', label: 'Generation Jobs', icon: Clapperboard },
  { href: '/assets', label: 'Assets', icon: Image },
]

const insightNavItems: NavItem[] = [
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/agency', label: 'Agency', icon: Building },
]

const systemNavItems: NavItem[] = [
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/contact', label: 'Support', icon: LifeBuoy },
]

type SidebarProps = {
  isCollapsed?: boolean
  toggleSidebar?: () => void
  orgId?: string
}

function navLink(item: NavItem, pathname: string, isCollapsed: boolean) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const Icon = item.icon
  return (
    <Link
      key={item.href}
      href={item.href}
      className={cn(
        'group flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
        isCollapsed && 'justify-center px-2',
        isActive
          ? 'border-primary/30 bg-primary/12 text-primary shadow-[0_14px_30px_-20px_rgba(55,120,255,0.5)]'
          : 'border-transparent text-muted-foreground hover:border-border/70 hover:bg-background/75 hover:text-foreground'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}
      />
      {!isCollapsed ? <span className="truncate font-medium tracking-tight">{item.label}</span> : null}
    </Link>
  )
}

function NavGroup({
  title,
  items,
  pathname,
  isCollapsed,
  phase,
}: {
  title: string
  items: NavItem[]
  pathname: string
  isCollapsed: boolean
  phase?: number
}) {
  return (
    <div className="space-y-1.5">
      {!isCollapsed ? (
        <div className="flex items-center gap-2 px-3 pb-2">
          {phase != null && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
              {phase}
            </span>
          )}
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            {title}
          </span>
        </div>
      ) : null}
      {items.map((item) => navLink(item, pathname, isCollapsed))}
    </div>
  )
}

export function Sidebar({ isCollapsed = false, toggleSidebar }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'relative hidden min-h-screen shrink-0 border-r border-border/60 bg-sidebar/55 px-3 py-4 backdrop-blur-2xl transition-all duration-300 ease-in-out lg:flex lg:flex-col',
        isCollapsed ? 'w-[92px]' : 'w-[292px]'
      )}
      suppressHydrationWarning
    >
      <div className="app-shell-panel mb-4 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          {!isCollapsed ? (
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Nexus Studio</div>
              <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">AI Content SaaS</div>
            </div>
          ) : (
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
              <LayoutDashboard className="h-5 w-5" />
            </div>
          )}
          {toggleSidebar ? (
            <Button variant="ghost" size="icon-sm" className="rounded-full" onClick={toggleSidebar}>
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          ) : null}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-1 py-2 custom-scrollbar" suppressHydrationWarning>
        <NavGroup title="Home" items={homeNavItems} pathname={pathname} isCollapsed={isCollapsed} />
        <NavGroup title="Workflow" items={workflowNavItems} pathname={pathname} isCollapsed={isCollapsed} phase={1} />
        <NavGroup title="Insights" items={insightNavItems} pathname={pathname} isCollapsed={isCollapsed} phase={2} />
        <div className="mt-auto border-t border-border/60 pt-5">
          <NavGroup title="System" items={systemNavItems} pathname={pathname} isCollapsed={isCollapsed} />
        </div>
      </nav>
    </aside>
  )
}
