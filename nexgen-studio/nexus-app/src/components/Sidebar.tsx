'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/creators', label: 'Creators', icon: '👥' },
  { href: '/influencers', label: 'Influencers', icon: '🎭' },
  { href: '/studio', label: 'Studio', icon: '🎨' },
  { href: '/generations', label: 'Generations', icon: '✨' },
  { href: '/assets', label: 'Assets', icon: '🖼️' },
  { href: '/calendar', label: 'Calendar', icon: '📅' },
  { href: '/posts', label: 'Posts', icon: '📝' },
  { href: '/automation', label: 'Automation', icon: '⚡' },
  { href: '/content-plans', label: 'Content Plans', icon: '📋' },
  { href: '/models', label: 'Models', icon: '🤖' },
  { href: '/inbox', label: 'Inbox', icon: '📬' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold">AI Influencer Studio</h1>
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
