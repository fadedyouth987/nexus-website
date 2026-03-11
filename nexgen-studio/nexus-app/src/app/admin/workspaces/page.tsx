'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

type WorkspaceRow = {
  id: string
  name: string
  owner: string
  plan: string
  nsfw_enabled: boolean
  created_at?: string
}

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/workspaces', { credentials: 'include' })
      .then((r) => {
        if (r.status === 403 || r.status === 401) throw new Error('Access denied')
        return r.json()
      })
      .then((data) => {
        setWorkspaces(Array.isArray(data) ? data : [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const handleToggleNsfw = (workspaceId: string) => {
    setWorkspaces(
      workspaces.map((ws) =>
        ws.id === workspaceId ? { ...ws, nsfw_enabled: !ws.nsfw_enabled } : ws
      )
    );
    console.log(`Toggling NSFW for workspace ${workspaceId}`);
  };

  const handleChangePlan = (workspaceId: string, newPlan: string) => {
    setWorkspaces(
      workspaces.map((ws) => (ws.id === workspaceId ? { ...ws, plan: newPlan } : ws))
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
      <h1 className="text-2xl font-bold mb-4 text-foreground">Admin: Workspace Management</h1>

      <Card>
        <CardHeader>
          <CardTitle>All Workspaces</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>NSFW Enabled</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workspaces.map((workspace) => (
                <TableRow key={workspace.id}>
                  <TableCell className="font-medium">{workspace.name}</TableCell>
                  <TableCell>{workspace.owner}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{workspace.plan}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`nsfw-toggle-${workspace.id}`}
                        checked={workspace.nsfw_enabled}
                        onCheckedChange={() => handleToggleNsfw(workspace.id)}
                      />
                      <Label htmlFor={`nsfw-toggle-${workspace.id}`}>
                        {workspace.nsfw_enabled ? "Enabled" : "Disabled"}
                      </Label>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" className="mr-2" onClick={() => handleChangePlan(workspace.id, "PRO")}>
                      Change plan
                    </Button>
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
