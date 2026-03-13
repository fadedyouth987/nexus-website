'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import apiFetch from '@/lib/core/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer'
type TeamMember = { id: string; userId: string; role: TeamRole; email: string | null; name: string | null }
type TeamInvite = { id: string; email: string; role: TeamRole; status: string; token: string | null; expiresAt?: string | null }
type TeamResponse = {
  mode: 'solo' | 'organization'
  role: TeamRole
  org: { id: string; name: string } | null
  members: TeamMember[]
  invites: TeamInvite[]
}

export default function TeamSettingsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [team, setTeam] = useState<TeamResponse | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<TeamRole>('viewer')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }

    if (status === 'authenticated') {
      void loadTeam()
    }
  }, [status, router])

  const loadTeam = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await apiFetch('/org/members')
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load team')
      }
      setTeam((await response.json()) as TeamResponse)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team settings')
    } finally {
      setLoading(false)
    }
  }

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return
    setSaving(true)
    setError(null)
    try {
      const response = await apiFetch('/org/members', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to invite member')
      }
      setInviteEmail('')
      await loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite member')
    } finally {
      setSaving(false)
    }
  }

  const updateMemberRole = async (memberId: string, role: TeamRole) => {
    setSaving(true)
    setError(null)
    try {
      const response = await apiFetch('/org/members', {
        method: 'PATCH',
        body: JSON.stringify({ memberId, role }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to update role')
      }
      await loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  const removeMember = async (memberId: string) => {
    setSaving(true)
    setError(null)
    try {
      const response = await apiFetch(`/org/members?memberId=${encodeURIComponent(memberId)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to remove member')
      }
      await loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setSaving(false)
    }
  }

  const revokeInvite = async (inviteId: string) => {
    setSaving(true)
    setError(null)
    try {
      const response = await apiFetch(`/org/members?inviteId=${encodeURIComponent(inviteId)}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to revoke invite')
      }
      await loadTeam()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invite')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!team) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="py-4 text-sm text-red-700 space-y-3">
          <p>{error || 'Organization context missing'}</p>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/organization">Open Organization</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const canManageTeam = team.role === 'owner' || team.role === 'admin'

  if (team.mode === 'solo') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Solo Workspace</CardTitle>
          <CardDescription>
            You are currently running in solo mode. Team features activate after creating an organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <p>Solo mode works without team setup. Upgrade to organization mode when you need collaborators or enterprise governance.</p>
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/organizations">Create organization</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/billing">Open billing</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!canManageTeam) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle>Access Restricted</CardTitle>
          <CardDescription>Team settings require owner or admin role.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-amber-800">
          <p>
            Your current role is <span className="font-medium capitalize">{team.role}</span>. Editors and viewers cannot access team management.
          </p>
          <div className="mt-3 flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/settings/organization">View organization</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Team - {team.org?.name || 'Organization'}</CardTitle>
          <CardDescription>Invite members and assign roles for enterprise workflows.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-[1.3fr_0.8fr_auto]">
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={saving}
            />
            <select
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as TeamRole)}
              disabled={saving}
            >
              <option value="viewer">viewer</option>
              <option value="editor">editor</option>
              <option value="admin">admin</option>
              <option value="owner">owner</option>
            </select>
            <Button onClick={() => void inviteMember()} disabled={saving || !inviteEmail.trim()}>
              Invite
            </Button>
          </div>
          <div className="rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left">Member</th>
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {team.members.map((member) => (
                  <tr key={member.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <div className="font-medium">{member.name || 'User'}</div>
                      <div className="text-xs text-muted-foreground">{member.email || member.userId}</div>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                        value={member.role}
                        onChange={(e) => void updateMemberRole(member.id, e.target.value as TeamRole)}
                        disabled={saving}
                      >
                        <option value="viewer">viewer</option>
                        <option value="editor">editor</option>
                        <option value="admin">admin</option>
                        <option value="owner">owner</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() => void removeMember(member.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {team.invites.length > 0 ? (
            <div className="rounded-md border border-border p-3">
              <div className="text-sm font-medium">Pending invites</div>
              <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
                {team.invites.map((invite) => (
                  <li key={invite.id} className="rounded border border-border p-2">
                    <div>
                      {invite.email} - {invite.role} - {invite.status}
                      {invite.expiresAt ? ` - expires ${new Date(invite.expiresAt).toLocaleDateString()}` : ''}
                    </div>
                    {invite.token ? (
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            navigator.clipboard.writeText(`${window.location.origin}/invite?token=${invite.token}`)
                          }
                        >
                          Copy invite link
                        </Button>
                        {invite.status === 'pending' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={saving}
                            onClick={() => void revokeInvite(invite.id)}
                          >
                            Revoke
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
