import Link from 'next/link'
import MainLayout from '@/app/main-layout'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MainLayout>
      <div className="space-y-6 p-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Organization, verification, and access management.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings/verification"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            Age & NSFW
          </Link>
          <Link
            href="/settings/organization"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            Organization
          </Link>
          <Link
            href="/settings/team"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            Team
          </Link>
          <Link
            href="/settings/billing"
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            Billing
          </Link>
        </div>
        {children}
      </div>
    </MainLayout>
  )
}
