'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/core/utils'
import { CommandPalette } from './CommandPalette'

type RailItem = {
  label: string
  href: string
  short: string
}

const PRIMARY_ITEMS: RailItem[] = [
  { label: 'Studio', href: '/studio', short: 'ST' },
  { label: 'Production', href: '/production', short: 'PR' },
  { label: 'Creators', href: '/creators', short: 'CR' },
]

const OVERFLOW_ITEMS: RailItem[] = [
  { label: 'Series', href: '/series', short: 'SR' },
  { label: 'Agency', href: '/agency', short: 'AG' },
  { label: 'Settings', href: '/settings/organization', short: 'SE' },
]

export function StudioLeftRail() {
  const pathname = usePathname()
  const [pinned, setPinned] = useState(true)

  const railWidth = useMemo(() => (pinned ? 'w-56' : 'w-20'), [pinned])

  return (
    <aside className={cn('border-r border-border bg-card p-3 transition-all duration-300', railWidth)}>
      <div className="mb-4 flex items-center justify-between gap-2">
        {pinned ? <p className="text-sm font-semibold">Studio Rail</p> : <p className="text-xs font-semibold">ST</p>}
        <Button variant="outline" size="sm" onClick={() => setPinned((prev) => !prev)}>
          {pinned ? 'Unpin' : 'Pin'}
        </Button>
      </div>

      <div className="space-y-1">
        {PRIMARY_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md border px-2 py-2 text-sm transition-colors',
                active ? 'border-primary bg-primary/10 text-primary' : 'border-transparent hover:bg-muted'
              )}
            >
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{item.short}</span>
              {pinned ? <span>{item.label}</span> : null}
            </Link>
          )
        })}
      </div>

      <div className="mt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-start">
              More
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {OVERFLOW_ITEMS.map((item) => (
              <DropdownMenuItem key={item.href} asChild>
                <Link href={item.href}>{item.label}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3">
        <CommandPalette />
      </div>

      <div className="mt-3">
        <Button asChild variant="ghost" className="w-full justify-start">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    </aside>
  )
}
