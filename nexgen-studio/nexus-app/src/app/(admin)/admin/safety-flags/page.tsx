'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AdminAsyncState, AdminPageShell } from '@/components/admin/AdminPageShell'

type FlagRow = { id: string; workspaceId: string; flagType: string; severity: string; description: string; status: string; createdAt: string }

export default function AdminSafetyFlagsPage() {
  const [safetyFlags, setSafetyFlags] = useState<FlagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/safety-flags', { credentials: 'include' })
      .then((r) => {
        if (r.status === 403 || r.status === 401) throw new Error('Access denied')
        return r.json()
      })
      .then((data) => setSafetyFlags(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const handleUpdateFlagStatus = (flagId: string, newStatus: string) => {
    setSafetyFlags(
      safetyFlags.map((flag) => (flag.id === flagId ? { ...flag, status: newStatus } : flag))
    )
  }

  if (loading) {
    return <AdminAsyncState loading={loading} error={null} />
  }
  if (error) {
    return <AdminAsyncState loading={false} error={error} />
  }

  return (
    <AdminPageShell
      title="Safety Flags"
      description="Review safety events, severity signals, and moderation outcomes."
    >
      <Card>
        <CardHeader>
          <CardTitle>All Safety Flags</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safetyFlags.map((flag) => (
                <TableRow key={flag.id}>
                  <TableCell className="font-medium">{flag.id}</TableCell>
                  <TableCell>{flag.flagType}</TableCell>
                  <TableCell>
                    <Badge variant={flag.severity === "CRITICAL" ? "destructive" : "secondary"}>
                      {flag.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>{flag.description}</TableCell>
                  <TableCell>
                    <Badge>{flag.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(flag.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {flag.status === "OPEN" || flag.status === "UNDER_REVIEW" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          onClick={() => handleUpdateFlagStatus(flag.id, "RESOLVED")}
                        >
                          Resolve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleUpdateFlagStatus(flag.id, "REJECTED")}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <span className="text-muted-foreground">No actions</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminPageShell>
  )
}
