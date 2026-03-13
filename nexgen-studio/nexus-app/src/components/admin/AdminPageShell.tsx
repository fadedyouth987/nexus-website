import type { ReactNode } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'

type AdminPageShellProps = {
  title: string
  description: string
  children: ReactNode
}

export function AdminPageShell({ title, description, children }: AdminPageShellProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Admin' },
        ]}
        actions={
          <Link
            href="/dashboard"
            className="rounded-full border border-border/70 bg-background/70 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to app
          </Link>
        }
      />
      {children}
    </div>
  )
}

export function AdminAsyncState(props: { loading: boolean; error: string | null }) {
  if (props.loading) {
    return <div className="app-surface-card p-4 text-sm text-muted-foreground">Loading…</div>
  }

  if (props.error) {
    return <div className="app-callout app-callout-danger text-sm">{props.error}</div>
  }

  return null
}
