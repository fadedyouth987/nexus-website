'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import apiFetch from '@/lib/core/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function InvitePageContent() {
  const searchParams = useSearchParams()
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const queryToken = searchParams.get('token')
    if (queryToken) setToken(queryToken)
  }, [searchParams])

  const acceptInvite = async () => {
    if (!token.trim()) return
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const res = await apiFetch('/org/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token: token.trim() }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to accept invite')
      }
      setMessage('Invite accepted. You can now access team and organization settings.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept invite')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <Card>
        <CardHeader>
          <CardTitle>Accept Team Invite</CardTitle>
          <CardDescription>Join the organization using your invite token.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Invite token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={loading}
          />
          <Button onClick={() => void acceptInvite()} disabled={loading || !token.trim()}>
            {loading ? 'Accepting...' : 'Accept Invite'}
          </Button>
          {message ? <p className="text-sm text-green-700">{message}</p> : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="pt-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/team">Go to Team settings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-lg p-6 text-sm text-muted-foreground">Loading invite...</div>}>
      <InvitePageContent />
    </Suspense>
  )
}

