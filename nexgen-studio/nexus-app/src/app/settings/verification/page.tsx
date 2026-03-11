'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PageHeader } from '@/components/layout/PageHeader'
import apiFetch from '@/lib/core/api'

const TERMS_TEXT = `Nexus Studio – Age Verification & NSFW Access Terms

1. Age requirement
You must be at least 18 years of age (or the age of majority in your jurisdiction) to enable NSFW content access. By confirming your age and accepting these terms, you represent that you meet this requirement.

2. NSFW content
"NSFW" (Not Safe For Work) content may include adult, sexually suggestive, or otherwise restricted material. Enabling NSFW access is optional and at your sole discretion. All NSFW content and features are gated until you complete verification (age confirmation, acceptance of these terms, and phone verification).

3. Verification
Verification may include: (a) confirming your date of birth, (b) accepting these terms, and (c) completing a one-time phone (SMS) verification. We use this to protect minors and to comply with applicable laws. Verification data is handled in accordance with our Privacy Policy.

4. Gating
When you turn on the NSFW toggle, access to all NSFW content, uploads, and features remains blocked until you have completed all required verification steps. No NSFW content will be shown or usable until then.

5. Compliance
You are responsible for ensuring your use of NSFW features complies with local laws and platform policies. We may revoke access or require re-verification at any time.

6. Changes
We may update these terms. Continued use of NSFW features after changes constitutes acceptance.`

const COOKIE_TERMS = 'nexgen_terms_accepted_18'
const COOKIE_NSFW_GATE = 'nexgen_nsfw_gate_enabled'

function getCookie(name: string): boolean {
  if (typeof document === 'undefined') return false
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'))
  return match ? match[1] === 'true' : false
}

function setCookie(name: string, value: string, maxAgeDays: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeDays * 24 * 60 * 60}; SameSite=Lax`
}

export default function VerificationPage() {
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [dob, setDob] = useState('')
  const [ageVerifying, setAgeVerifying] = useState(false)
  const [ageVerified, setAgeVerified] = useState(false)
  const [nsfwEnabled, setNsfwEnabled] = useState(false)
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsVerifying, setSmsVerifying] = useState(false)
  const [verificationLevel, setVerificationLevel] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadState = useCallback(async () => {
    setTermsAccepted(getCookie(COOKIE_TERMS))
    setNsfwEnabled(getCookie(COOKIE_NSFW_GATE))
    try {
      const res = await fetch('/api/age-gate', { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      setAgeVerified((data as { verified?: boolean }).verified === true)
    } catch {
      setAgeVerified(false)
    }
  }, [])

  useEffect(() => {
    loadState()
  }, [loadState])

  const fetchVerificationLevel = useCallback(async () => {
    try {
      const res = await apiFetch('/models?page=1&page_size=1')
      const data = await res.json().catch(() => ({}))
      const level = Number((data as { userVerificationLevel?: number }).userVerificationLevel ?? 0)
      setVerificationLevel(Number.isFinite(level) ? level : 0)
    } catch {
      setVerificationLevel(0)
    }
  }, [])

  useEffect(() => {
    fetchVerificationLevel()
  }, [fetchVerificationLevel])

  const handleAcceptTerms = (checked: boolean) => {
    setTermsAccepted(checked)
    setCookie(COOKIE_TERMS, checked ? 'true' : 'false', 365)
  }

  const handleConfirmAge = async () => {
    if (!dob) {
      setError('Please enter your date of birth.')
      return
    }
    setAgeVerifying(true)
    setError(null)
    setMessage(null)
    try {
      const res = await fetch('/api/age-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dob }),
        credentials: 'include',
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((payload as { error?: string }).error || 'Age verification failed')
      }
      setAgeVerified(true)
      setMessage('Age verified. You are 18+.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Age verification failed')
    } finally {
      setAgeVerifying(false)
    }
  }

  const handleNsfwToggle = (checked: boolean) => {
    setNsfwEnabled(checked)
    setCookie(COOKIE_NSFW_GATE, checked ? 'true' : 'false', 365)
    setError(null)
    if (checked) {
      setMessage('NSFW access is gated until you complete all steps below.')
    }
  }

  const sendOtp = async () => {
    setError(null)
    setMessage(null)
    setSmsSending(true)
    try {
      const res = await apiFetch('/verify/level1/send', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((payload as { detail?: string }).detail || 'Failed to send OTP')
      setMessage('Verification code sent. It expires in 10 minutes.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send OTP')
    } finally {
      setSmsSending(false)
    }
  }

  const verifyOtp = async () => {
    setError(null)
    setMessage(null)
    setSmsVerifying(true)
    try {
      const res = await apiFetch('/verify/level1/verify', {
        method: 'POST',
        body: JSON.stringify({ phone: phone.trim(), code: otpCode.trim() }),
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((payload as { detail?: string }).detail || 'Verification failed')
      setMessage('Phone verified. Level 1 verification complete.')
      setOtpCode('')
      await fetchVerificationLevel()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setSmsVerifying(false)
    }
  }

  const allComplete = termsAccepted && ageVerified && verificationLevel >= 1
  const nsfwGated = nsfwEnabled && !allComplete

  return (
    <div className="space-y-[var(--section-gap)]">
      <PageHeader
        title="Age verification & NSFW access"
        description="Confirm your age, accept terms, and verify with OTP. When NSFW is enabled, all NSFW content is gated until verification is complete."
      />

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </div>
      ) : null}

      {/* Terms and conditions */}
      <Card className="rounded-xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Terms and conditions</CardTitle>
          <CardDescription>You must read and accept these terms before enabling NSFW access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-48 w-full rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <pre className="whitespace-pre-wrap font-sans">{TERMS_TEXT}</pre>
          </ScrollArea>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="terms"
              checked={termsAccepted}
              onCheckedChange={(c) => handleAcceptTerms(c === true)}
            />
            <Label htmlFor="terms" className="text-sm font-medium cursor-pointer">
              I am at least 18 years old and I agree to these terms.
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* 18+ age verification */}
      <Card className="rounded-xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">18+ age verification</CardTitle>
          <CardDescription>Confirm your date of birth. We do not store your full DOB.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ageVerified ? (
            <p className="text-sm text-muted-foreground">Age verified.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="max-w-[200px]"
                  />
                </div>
                <Button onClick={handleConfirmAge} disabled={ageVerifying || !dob}>
                  {ageVerifying ? 'Verifying...' : 'Confirm 18+'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* NSFW toggle – when on, everything gated until verification complete */}
      <Card className="rounded-xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">NSFW access</CardTitle>
          <CardDescription>
            Enable access to NSFW content and features. When this is on, all NSFW content remains gated until you complete the steps above (terms, 18+, and OTP).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Enable NSFW access</p>
              <p className="text-xs text-muted-foreground">
                When enabled, you must complete verification before any NSFW content is visible or usable.
              </p>
            </div>
            <Switch checked={nsfwEnabled} onCheckedChange={handleNsfwToggle} />
          </div>
          {nsfwGated && (
            <div className="mt-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
              NSFW content is gated. Complete terms, 18+ confirmation, and OTP verification above to unlock.
            </div>
          )}
        </CardContent>
      </Card>

      {/* OTP verification */}
      <Card className="rounded-xl border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Phone verification (OTP)</CardTitle>
          <CardDescription>One-time code sent to your phone. Required for Level 1 verification and NSFW access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {verificationLevel >= 1 ? (
            <p className="text-sm text-muted-foreground">Level 1 verification complete.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (E.164)</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+614XXXXXXXX"
                />
              </div>
              <div className="flex items-end">
                <Button variant="secondary" onClick={sendOtp} disabled={smsSending || !phone.trim()}>
                  {smsSending ? 'Sending...' : 'Send code'}
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="otp">SMS code</Label>
                <Input
                  id="otp"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="6-digit code"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={verifyOtp} disabled={smsVerifying || !phone.trim() || !otpCode.trim()}>
                  {smsVerifying ? 'Verifying...' : 'Verify'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <Link href="/settings" className="underline hover:text-foreground">Back to Settings</Link>
        <Link href="/studio" className="underline hover:text-foreground">Studio (model upload)</Link>
      </div>
    </div>
  )
}
