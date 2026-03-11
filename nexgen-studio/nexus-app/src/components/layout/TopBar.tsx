'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Bell, ChevronDown, ChevronRight, Monitor, Moon, Search, Sparkles, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useWorkspace } from '@/context/WorkspaceContext'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CommandPalette } from '@/app/studio/CommandPalette'
import { SITE_NAME } from '@/lib/sitemap'

const navTitles: Array<{ prefix: string; title: string }> = [
  { prefix: '/dashboard/social', title: 'Socials' },
  { prefix: '/dashboard', title: 'Dashboard' },
  { prefix: '/automation/planner', title: 'Content planner' },
  { prefix: '/gallery', title: 'Gallery' },
  { prefix: '/vault', title: 'Vault' },
  { prefix: '/studio', title: 'Studio' },
  { prefix: '/edit', title: 'Edit' },
  { prefix: '/design', title: 'Design' },
  { prefix: '/automation/scheduler', title: 'Scheduler' },
  { prefix: '/analytics', title: 'Analytics' },
  { prefix: '/monetization', title: 'Monetization' },
  { prefix: '/automation', title: 'Automation' },
  { prefix: '/inbox', title: 'Inbox' },
  { prefix: '/agency', title: 'Agency' },
  { prefix: '/assets', title: 'Assets' },
  { prefix: '/generations', title: 'Generations' },
  { prefix: '/portfolio', title: 'Portfolio' },
  { prefix: '/creators', title: 'Creators' },
  { prefix: '/intelligence', title: 'Intelligence' },
  { prefix: '/series', title: 'Series' },
  { prefix: '/organizations', title: 'Organizations' },
  { prefix: '/influencers', title: 'Influencers' },
  { prefix: '/models', title: 'Models' },
  { prefix: '/learn', title: 'Documentation' },
  { prefix: '/contact', title: 'Support' },
  { prefix: '/settings/verification', title: 'Age & NSFW' },
  { prefix: '/settings/billing', title: 'Billing' },
  { prefix: '/settings/team', title: 'Team' },
  { prefix: '/settings/organization', title: 'Organization' },
  { prefix: '/settings', title: 'Settings' },
  { prefix: '/audit-logs', title: 'Audit Logs' },
]

export function TopBar() {
  const { data: session } = useSession()
  const { currentWorkspace, workspaces } = useWorkspace()
  const pathname = usePathname()
  const { setTheme } = useTheme()

  const title = useMemo(() => {
    const matched = navTitles.find((item) => pathname === item.prefix || pathname.startsWith(item.prefix + '/'))
    return matched?.title || 'Workspace'
  }, [pathname])

  const primaryAction = useMemo(() => {
    if (pathname.startsWith('/dashboard/social')) return { label: 'Open planner', href: '/automation/planner' }
    if (pathname.startsWith('/automation/planner')) return { label: 'Generate content plan', href: '/automation/planner' }
    if (pathname.startsWith('/gallery')) return { label: 'Create in Studio', href: '/studio' }
    if (pathname.startsWith('/vault')) return { label: 'Verification', href: '/settings/verification' }
    if (pathname.startsWith('/studio')) return { label: 'Create influencer', href: '/creators/create' }
    if (pathname.startsWith('/automation/scheduler')) return { label: 'New schedule', href: '/automation/scheduler?new=1' }
    if (pathname.startsWith('/inbox')) return { label: 'Link accounts', href: '/dashboard/social' }
    if (pathname.startsWith('/automation')) return { label: 'Open planner', href: '/automation/planner' }
    if (pathname.startsWith('/analytics')) return { label: 'Open Intelligence', href: '/intelligence' }
    if (pathname.startsWith('/monetization')) return { label: 'Open Billing', href: '/settings/billing' }
    return { label: 'Start plan', href: '/automation/planner' }
  }, [pathname])

  return (
    <div className="sticky top-0 z-30 px-[var(--content-padding)] pt-4">
      <header className="app-shell-panel px-4 py-3 sm:px-5" suppressHydrationWarning>
        <nav className="flex flex-wrap items-center justify-between gap-4" suppressHydrationWarning>
          <div className="flex min-w-0 items-center gap-4" suppressHydrationWarning>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground" suppressHydrationWarning>
                <Link href="/dashboard" className="transition-colors hover:text-foreground">
                  {SITE_NAME}
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <span className="truncate">{title}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-semibold tracking-tight text-foreground">{title}</span>
                {currentWorkspace ? (
                  <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                    {currentWorkspace.name}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="hidden min-w-[260px] flex-1 items-center justify-center xl:flex" suppressHydrationWarning>
            <div className="flex w-full max-w-lg items-center gap-2 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm text-muted-foreground shadow-inner">
              <Search className="h-4 w-4 text-muted-foreground/60" />
              <input
                placeholder="Search flows, creators, or assets..."
                className="w-full bg-transparent text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              <kbd className="rounded border border-border/70 bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Ctrl+K
              </kbd>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2" suppressHydrationWarning>
            <div className="hidden items-center gap-2 lg:flex">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {workspaces.length} workspace{workspaces.length === 1 ? '' : 's'}
              </div>
              <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
                <Bell className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-foreground">
                    <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40 rounded-xl">
                  <DropdownMenuItem onClick={() => setTheme('light')}>
                    <Sun className="mr-2 h-4 w-4" /> Light
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <Moon className="mr-2 h-4 w-4" /> Dark
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')}>
                    <Monitor className="mr-2 h-4 w-4" /> System
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <CommandPalette />
            </div>

            <Button asChild className="rounded-full px-5 text-xs font-bold uppercase tracking-[0.18em]">
              <Link href={primaryAction.href}>{primaryAction.label}</Link>
            </Button>

            {session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-10 gap-2 rounded-full border border-border/70 bg-background/70 px-1.5 pr-3 hover:bg-muted/60">
                    <Avatar className="h-7 w-7 border shadow-sm">
                      {session.user.image ? <AvatarImage src={session.user.image} alt={session.user.name ?? 'User'} /> : null}
                      <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                        {session.user.name ? session.user.name.charAt(0) : 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 rounded-2xl p-2" align="end" forceMount>
                  <div className="px-3 py-3">
                    <p className="text-sm font-bold leading-none tracking-tight">{session.user.name || 'Account'}</p>
                    <p className="mt-1 text-xs leading-none text-muted-foreground">{session.user.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-1">
                    <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2 text-sm">
                      <Link href="/settings/organization">Organization Settings</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2 text-sm">
                      <Link href="/settings/team">Team Management</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2 text-sm">
                      <Link href="/settings/billing">Subscription and Billing</Link>
                    </DropdownMenuItem>
                  </div>
                  <DropdownMenuSeparator />
                  <div className="p-1">
                    <DropdownMenuItem
                      onClick={() => signOut({ callbackUrl: '/auth' })}
                      className="cursor-pointer rounded-lg py-2 text-sm text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      Log out
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/auth" className="text-sm font-semibold hover:text-primary">
                Login
              </Link>
            )}
          </div>
        </nav>
      </header>
    </div>
  )
}
