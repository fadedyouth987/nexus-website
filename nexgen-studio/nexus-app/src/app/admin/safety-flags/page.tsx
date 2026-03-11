'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-react'

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
    return (
      <div className="container mx-auto p-4 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading…
      </div>
    )
  }
  if (error) {
    return (
      <div className="container mx-auto p-4">
        <p className="text-destructive">{error}</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-foreground">Admin: Safety Flags</h1>

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
    </div>
  );
}
