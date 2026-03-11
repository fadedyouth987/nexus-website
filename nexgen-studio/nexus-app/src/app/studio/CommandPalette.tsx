'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type CommandItem = {
  label: string
  href: string
  hint?: string
}

const COMMANDS: CommandItem[] = [
  { label: 'Studio', href: '/studio', hint: 'Model uploads and moderation' },
  { label: 'Dashboard', href: '/dashboard', hint: 'Back to main workspace' },
  { label: 'Creators', href: '/creators', hint: 'Manage creator profiles' },
  { label: 'Production', href: '/production', hint: 'Generation and asset ops' },
  { label: 'Series', href: '/series', hint: 'Series projects and episodes' },
  { label: 'Agency', href: '/agency', hint: 'Agency-level analytics' },
  { label: 'Settings', href: '/settings/organization', hint: 'Org and billing settings' },
]

function scoreCommand(query: string, item: CommandItem) {
  const q = query.trim().toLowerCase()
  if (!q) return 1

  const label = item.label.toLowerCase()
  const hint = (item.hint || '').toLowerCase()
  if (label.startsWith(q)) return 100
  if (label.includes(q)) return 80
  if (hint.includes(q)) return 50

  // Simple fuzzy subsequence score.
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

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Command Palette
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Command Palette</DialogTitle>
          </DialogHeader>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a route or action... (Ctrl/Cmd + K)"
            autoFocus
          />
          <div className="max-h-80 space-y-1 overflow-y-auto pt-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No results.</p>
            ) : (
              filtered.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => go(item.href)}
                  className="w-full rounded-md border border-border px-3 py-2 text-left hover:bg-muted"
                >
                  <p className="text-sm font-medium">{item.label}</p>
                  {item.hint ? <p className="text-xs text-muted-foreground">{item.hint}</p> : null}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
