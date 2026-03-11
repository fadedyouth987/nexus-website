'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Archive,
  BookOpenText,
  Building,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Images,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  Palette,
  Pencil,
  Settings,
  Share2,
  Shield,
  Users2,
  Video,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/core/utils'
import { Button } from '@/components/ui/button'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const dashboardNavItems: NavItem[] = [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }]
const planCreateNavItems: NavItem[] = [
  { href: '/studio', label: 'Studio', icon: Video },
  { href: '/edit', label: 'Edit', icon: Pencil },
  { href: '/design', label: 'Design', icon: Palette },
]
const publishEngageNavItems: NavItem[] = [
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/dashboard/social', label: 'Socials', icon: Share2 },
]
const contentNavItems: NavItem[] = [
  { href: '/gallery', label: 'Gallery', icon: Images },
  { href: '/vault', label: 'Vault', icon: Archive },
]
const automationNavItems: NavItem[] = [
  { href: '/automation', label: 'Automation', icon: Workflow },
  { href: '/automation/planner', label: 'Content planner', icon: CalendarRange },
]
const settingsNavItems: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/settings/verification', label: 'Age & NSFW', icon: Shield },
  { href: '/settings/billing', label: 'Billing', icon: CreditCard },
  { href: '/settings/team', label: 'Team', icon: Users2 },
  { href: '/settings/organization', label: 'Organization', icon: Building },
  { href: '/learn', label: 'Documentation', icon: BookOpenText },
  { href: '/contact', label: 'Support', icon: LifeBuoy },
  { href: '/audit-logs', label: 'Audit Logs', icon: FileText },
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
}: {
  title: string
  items: NavItem[]
  pathname: string
  isCollapsed: boolean
}) {
  return (
    <div className="space-y-1.5">
      {!isCollapsed ? (
        <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
          {title}
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
              <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">Creator operating system</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Studio, automation, publishing, and analytics in one matching shell.
              </p>
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

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-1 py-2 custom-scrollbar" suppressHydrationWarning>
        <NavGroup title="Overview" items={dashboardNavItems} pathname={pathname} isCollapsed={isCollapsed} />
        <NavGroup title="Creation" items={planCreateNavItems} pathname={pathname} isCollapsed={isCollapsed} />
        <NavGroup title="Engagement" items={publishEngageNavItems} pathname={pathname} isCollapsed={isCollapsed} />
        <NavGroup title="Management" items={contentNavItems} pathname={pathname} isCollapsed={isCollapsed} />
        <NavGroup title="Scale" items={automationNavItems} pathname={pathname} isCollapsed={isCollapsed} />
        <div className="mt-auto border-t border-border/60 pt-5">
          <NavGroup title="System" items={settingsNavItems} pathname={pathname} isCollapsed={isCollapsed} />
        </div>
      </nav>

      {!isCollapsed ? (
        <div className="app-shell-panel-muted mt-4 px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">First wave</div>
          <p className="mt-2 text-sm font-medium text-foreground">Dashboard flow now uses the landing-page language.</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Core routes inherit the new shell automatically.</p>
        </div>
      ) : null}
    </aside>
  )
}
