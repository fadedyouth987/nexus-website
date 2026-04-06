'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/core/utils'
import { Button } from '@/components/ui/button'
import { APP_NAVIGATION, type NavItem } from '@/lib/navigation'

// Re-export for compatibility
export type { NavItem }

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
      title={item.description}
    >
      <Icon
        className={cn(
          'h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110',
          isActive ? 'text-primary' : 'text-muted-foreground'
        )}
      />
      {!isCollapsed ? (
        <span className="flex flex-1 items-center gap-2 truncate font-medium tracking-tight">
          {item.label}
          {item.badge ? (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">
              {item.badge}
            </span>
          ) : null}
        </span>
      ) : null}
    </Link>
  )
}

function NavGroup({
  section,
  pathname,
  isCollapsed,
}: {
  section: (typeof APP_NAVIGATION)[number]
  pathname: string
  isCollapsed: boolean
}) {
  // Skip empty sections
  if (section.items.length === 0) return null

  return (
    <div className="space-y-1.5">
      {!isCollapsed ? (
        <div className="flex items-center gap-2 px-3 pb-2">
          {section.phase != null && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[9px] font-bold text-primary">
              {section.phase}
            </span>
          )}
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            {section.label}
          </span>
        </div>
      ) : null}
      {section.items.map((item) => navLink(item, pathname, isCollapsed))}
    </div>
  )
}

export function Sidebar({ isCollapsed = false, toggleSidebar }: SidebarProps) {
  const pathname = usePathname()

  // Primary nav sections (always visible)
  const primarySections = APP_NAVIGATION.filter((s) => s.id !== 'system')

  // System section (at bottom)
  const systemSection = APP_NAVIGATION.find((s) => s.id === 'system')

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
        {primarySections.map((section) => (
          <NavGroup key={section.id} section={section} pathname={pathname} isCollapsed={isCollapsed} />
        ))}

        {systemSection ? (
          <div className="mt-auto border-t border-border/60 pt-5">
            <NavGroup section={systemSection} pathname={pathname} isCollapsed={isCollapsed} />
          </div>
        ) : null}
      </nav>
    </aside>
  )
}
