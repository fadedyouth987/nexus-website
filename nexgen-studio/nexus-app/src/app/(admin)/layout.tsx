import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'

/** Avoid SSG/prerender when admin routes pull auth/DB without full env at build time */
export const dynamic = 'force-dynamic'

const adminLinks = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/workspaces', label: 'Workspaces' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/safety-flags', label: 'Safety' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <div className="space-y-5">
        <div className="app-surface-card flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <div className="app-section-kicker">Admin Console</div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Operations and policy controls</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {adminLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full border border-border/70 bg-background/70 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        {children}
      </div>
    </AppShell>
  )
}
