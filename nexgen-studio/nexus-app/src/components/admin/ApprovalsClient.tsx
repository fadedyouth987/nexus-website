'use client'

import { useState } from 'react'
import { Check, X, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import apiFetch from '@/lib/core/api'

type ApprovalJob = {
  id: string
  mode: 'IMAGE' | 'VIDEO'
  content_policy: string
  status: string
  created_at: string
  inputs_json: {
    prompt?: string
    [key: string]: unknown
  }
  policy_decision_json: Record<string, unknown>
  influencers: {
    name: string | null
    avatar_url: string | null
  } | null
}

export function ApprovalsClient({
  initialJobs,
  orgId,
}: {
  initialJobs: ApprovalJob[]
  orgId: string
}) {
  const [jobs, setJobs] = useState<ApprovalJob[]>(initialJobs)
  const [loading, setLoading] = useState<string | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleApprove(jobId: string) {
    setLoading(jobId)
    setActionError(null)

    try {
      const response = await apiFetch('/admin/approvals', {
        method: 'POST',
        body: JSON.stringify({ jobId, action: 'approve' }),
      })

      if (!response.ok) {
        const error = await response.json()
        setActionError(error.detail || 'Approval failed')
        return
      }

      // Remove approved job from list
      setJobs((prev) => prev.filter((j) => j.id !== jobId))
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Approval failed')
    } finally {
      setLoading(null)
    }
  }

  function openRejectDialog(jobId: string) {
    setSelectedJobId(jobId)
    setRejectionReason('')
    setRejectDialogOpen(true)
    setActionError(null)
  }

  async function handleReject() {
    if (!selectedJobId) return

    setLoading(selectedJobId)
    setActionError(null)

    try {
      const response = await apiFetch('/admin/approvals', {
        method: 'POST',
        body: JSON.stringify({
          jobId: selectedJobId,
          action: 'reject',
          reason: rejectionReason || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        setActionError(error.detail || 'Rejection failed')
        return
      }

      // Remove rejected job from list
      setJobs((prev) => prev.filter((j) => j.id !== selectedJobId))
      setRejectDialogOpen(false)
      setSelectedJobId(null)
      setRejectionReason('')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Rejection failed')
    } finally {
      setLoading(null)
    }
  }

  const pendingCount = jobs.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Approval Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review and manage pending generation jobs
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="text-3xl font-bold tabular-nums">{pendingCount}</div>
            <div className="text-xs text-muted-foreground">Pending Approval</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-3xl font-bold tabular-nums text-amber-600">
              {jobs.filter((j) => j.content_policy === 'NSFW').length}
            </div>
            <div className="text-xs text-muted-foreground">NSFW Content</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-3xl font-bold tabular-nums text-blue-600">
              {jobs.filter((j) => j.mode === 'VIDEO').length}
            </div>
            <div className="text-xs text-muted-foreground">Video Jobs</div>
          </CardContent>
        </Card>
      </div>

      {/* Error */}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {actionError}
          </div>
        </div>
      )}

      {/* Jobs List */}
      {pendingCount === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No pending approvals</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              All generation jobs have been processed. New jobs requiring approval will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    {/* Title row */}
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">
                        {job.inputs_json?.prompt?.slice(0, 60) || 'Untitled Generation'}
                        {(job.inputs_json?.prompt?.length || 0) > 60 ? '...' : ''}
                      </h3>
                      <Badge
                        variant={job.content_policy === 'NSFW' ? 'destructive' : 'secondary'}
                      >
                        {job.content_policy}
                      </Badge>
                      <Badge variant="outline">{job.mode}</Badge>
                    </div>

                    {/* Influencer */}
                    {job.influencers?.name && (
                      <p className="text-sm text-muted-foreground">
                        For: {job.influencers.name}
                      </p>
                    )}

                    {/* Details */}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>ID: {job.id.slice(0, 12)}...</span>
                      <span>
                        Submitted: {new Date(job.created_at).toLocaleString()}
                      </span>
                    </div>

                    {/* Policy info */}
                    {job.policy_decision_json && (
                      <div className="rounded-md bg-muted p-2 text-xs">
                        <span className="font-medium">Policy Check: </span>
                        Plan: {(job.policy_decision_json.plan as string) || 'unknown'}
                        {job.policy_decision_json.age_verified_at
                          ? ' · Age verified'
                          : ' · Age not verified'}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 lg:flex-col">
                    <Button
                      onClick={() => handleApprove(job.id)}
                      disabled={loading === job.id}
                      className="gap-2"
                    >
                      {loading === job.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => openRejectDialog(job.id)}
                      disabled={loading === job.id}
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Generation Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Provide a reason for rejection. This will be visible to the user.
            </p>
            <Textarea
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={loading === selectedJobId}
              className="gap-2"
            >
              {loading === selectedJobId && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Reject Job
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
