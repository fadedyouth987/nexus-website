'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AdminAsyncState, AdminPageShell } from '@/components/admin/AdminPageShell'

type ReportRow = { id: string; reporterEmail: string; target: string; reason: string; status: string; createdAt: string }

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/reports', { credentials: 'include' })
      .then((r) => {
        if (r.status === 403 || r.status === 401) throw new Error('Access denied')
        return r.json()
      })
      .then((data) => setReports(Array.isArray(data) ? data : []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  const handleUpdateReportStatus = (reportId: string, newStatus: string) => {
    setReports(
      reports.map((report) => (report.id === reportId ? { ...report, status: newStatus } : report))
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
      title="User Reports"
      description="Moderate submitted reports and track resolution status."
    >
      <Card>
        <CardHeader>
          <CardTitle>All User Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">{report.id}</TableCell>
                  <TableCell>{report.reporterEmail}</TableCell>
                  <TableCell>{report.target}</TableCell>
                  <TableCell>{report.reason}</TableCell>
                  <TableCell>
                    <Badge>{report.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(report.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    {report.status === "OPEN" || report.status === "UNDER_REVIEW" ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mr-2"
                          onClick={() => handleUpdateReportStatus(report.id, "RESOLVED")}
                        >
                          Resolve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => console.log(`Contacting reporter for ${report.id}`)}
                        >
                          Contact
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
