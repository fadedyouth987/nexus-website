'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import apiFetch from '@/lib/core/api'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const DISMISS_KEY = 'nexus_age_verification_prompt_dismissed'

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null
  const found = document.cookie
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
  if (!found) return null
  return found.slice(name.length + 1)
}

export function AgeVerificationPrompt() {
  const { status } = useSession()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ageVerified, setAgeVerified] = useState(false)
  const [verificationLevel, setVerificationLevel] = useState(0)
  const termsAccepted = useMemo(() => getCookieValue('nexgen_terms_accepted_18') === 'true', [])

  useEffect(() => {
    if (status !== 'authenticated') {
      setOpen(false)
      setLoading(false)
      return
    }
    let mounted = true
    const run = async () => {
      setLoading(true)
      try {
        const ageRes = await fetch('/api/age-gate', { credentials: 'include' })
        const ageData = await ageRes.json().catch(() => ({}))
        const verified = (ageData as { verified?: boolean }).verified === true
        let level = 0
        try {
          const modelRes = await apiFetch('/models?page=1&page_size=1')
          const modelData = await modelRes.json().catch(() => ({}))
          level = Number((modelData as { userVerificationLevel?: number }).userVerificationLevel || 0)
        } catch {
          level = 0
        }
        if (!mounted) return
        setAgeVerified(verified)
        setVerificationLevel(level)
        const dismissed = sessionStorage.getItem(DISMISS_KEY) === 'true'
        const complete = termsAccepted && verified && level >= 1
        setOpen(!complete && !dismissed)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [termsAccepted, status])

  if (loading) return null
  if (status !== 'authenticated') return null

  const complete = termsAccepted && ageVerified && verificationLevel >= 1
  if (complete) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Age Verification</DialogTitle>
          <DialogDescription>
            Finish age verification to keep NSFW content gated correctly and unlock verified publishing flows.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
          <div>Terms accepted: {termsAccepted ? 'Yes' : 'No'}</div>
          <div>18+ confirmed: {ageVerified ? 'Yes' : 'No'}</div>
          <div>Phone verification: {verificationLevel >= 1 ? 'Yes' : 'No'}</div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.setItem(DISMISS_KEY, 'true')
              setOpen(false)
            }}
          >
            Remind me later
          </Button>
          <Button asChild>
            <Link href="/settings/verification">Verify now</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

