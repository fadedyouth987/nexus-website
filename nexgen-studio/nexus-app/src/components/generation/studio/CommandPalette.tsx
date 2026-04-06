'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

type CommandItem = {
  label: string
  href: string
  hint?: string
  section?: string
}

const COMMANDS: CommandItem[] = [
  { label: 'Dashboard', href: '/dashboard', hint: 'Main workspace overview', section: 'Overview' },
  { label: 'Studio', href: '/studio', hint: 'Generate images and videos', section: 'Creation' },
  { label: 'Edit', href: '/edit', hint: 'Edit and refine assets', section: 'Creation' },
  { label: 'Design', href: '/design', hint: 'Brand system and presets', section: 'Creation' },
  { label: 'Production', href: '/production', hint: 'Batch generation workflows', section: 'Creation' },
  { label: 'Inbox', href: '/inbox', hint: 'Messages and DMs', section: 'Engagement' },
  { label: 'Socials', href: '/dashboard/social', hint: 'Connect social platforms', section: 'Engagement' },
  { label: 'Gallery', href: '/gallery', hint: 'Browse generated assets', section: 'Content' },
  { label: 'Vault', href: '/vault', hint: 'Premium and NSFW content', section: 'Content' },
  { label: 'Automation', href: '/automation', hint: 'Automation hub and workflows', section: 'Scale' },
  { label: 'Factory', href: '/automation/factory', hint: 'Create influencer personas', section: 'Scale' },
  { label: 'Planner', href: '/automation/planner', hint: 'Content planning and scheduling', section: 'Scale' },
  { label: 'Creators', href: '/creators', hint: 'Manage creator profiles', section: 'Management' },
  { label: 'Analytics', href: '/analytics', hint: 'Performance and growth metrics', section: 'Insights' },
  { label: 'Monetization', href: '/monetization', hint: 'Offers and revenue', section: 'Revenue' },
  { label: 'Agency', href: '/agency', hint: 'Multi-workspace management', section: 'Admin' },
  { label: 'Settings', href: '/settings/organization', hint: 'Organization settings', section: 'System' },
  { label: 'Billing', href: '/settings/billing', hint: 'Subscription and credits', section: 'System' },
  { label: 'Team', href: '/settings/team', hint: 'Team members and roles', section: 'System' },
  { label: 'Age & NSFW', href: '/settings/verification', hint: 'Age verification settings', section: 'System' },
  { label: 'Documentation', href: '/learn', hint: 'Guides and help', section: 'System' },
  { label: 'Support', href: '/contact', hint: 'Get help', section: 'System' },
  { label: 'Audit Logs', href: '/audit-logs', hint: 'Activity history', section: 'System' },
]

function scoreCommand(query: string, item: CommandItem) {
  const q = query.trim().toLowerCase()
  if (!q) return 1

  const label = item.label.toLowerCase()
  const hint = (item.hint || '').toLowerCase()
  const section = (item.section || '').toLowerCase()
  if (label.startsWith(q)) return 100
  if (label.includes(q)) return 80
  if (hint.includes(q)) return 50
  if (section.includes(q)) return 40

  let score = 0
  let cursor = 0
  for (const ch of q) {
    const idx = label.indexOf(ch, cursor)
    if (idx === -1) return 0
    score += 5
    cursor = idx + 1
  }
  return score
}

export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const filtered = useMemo(() => {
    const withScores = COMMANDS.map((item) => ({
      item,
      score: scoreCommand(query, item),
    }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)

    return withScores.map((entry) => entry.item)
  }, [query])

  const go = (href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }

  const sections = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    for (const item of filtered) {
      const sec = item.section || 'Other'
      if (!map.has(sec)) map.set(sec, [])
      map.get(sec)!.push(item)
    }
    return Array.from(map.entries())
  }, [filtered])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Search</DialogTitle>
        </DialogHeader>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pages, creators, assets..."
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered.length > 0) {
              go(filtered[0].href)
            }
          }}
        />
        <div className="max-h-80 space-y-3 overflow-y-auto pt-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No results for &ldquo;{query}&rdquo;</p>
          ) : (
            sections.map(([section, items]) => (
              <div key={section}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">{section}</p>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => go(item.href)}
                      className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted"
                    >
                      <p className="text-sm font-medium">{item.label}</p>
                      {item.hint ? <p className="text-xs text-muted-foreground">{item.hint}</p> : null}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function useCommandPalette() {
  return {
    open: () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    },
  }
}
