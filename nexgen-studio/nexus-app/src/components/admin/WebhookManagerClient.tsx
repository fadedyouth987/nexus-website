'use client'

import { useState } from 'react'
import {
  Webhook,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  AlertCircle,
  Send,
  Clock,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import apiFetch from '@/lib/core/api'

const VALID_EVENTS = [
  'generation.queued',
  'generation.generating',
  'generation.ready',
  'generation.failed',
  'generation.cancelled',
] as const

type WebhookEvent = (typeof VALID_EVENTS)[number]

type WebhookConfig = {
  id: string
  url: string
  events: WebhookEvent[]
  is_active: boolean
  created_at: string
  updated_at: string
  secret_key: string | null
}

type WebhookManagerProps = {
  initialWebhooks: WebhookConfig[]
  orgId: string
}

export function WebhookManagerClient({ initialWebhooks }: WebhookManagerProps) {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(initialWebhooks)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Form state
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([])
  const [isActive, setIsActive] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)

  function resetForm() {
    setUrl('')
    setSelectedEvents([])
    setIsActive(true)
    setFormError(null)
  }

  function openCreateDialog() {
    resetForm()
    setIsCreateDialogOpen(true)
    setActionError(null)
    setActionSuccess(null)
  }

  function openDeleteDialog(webhookId: string) {
    setSelectedWebhookId(webhookId)
    setIsDeleteDialogOpen(true)
    setActionError(null)
    setActionSuccess(null)
  }

  function toggleEvent(event: WebhookEvent) {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    )
  }

  async function handleCreate() {
    setFormError(null)

    // Validation
    if (!url.trim()) {
      setFormError('URL is required')
      return
    }

    try {
      new URL(url)
    } catch {
      setFormError('Invalid URL format')
      return
    }

    if (selectedEvents.length === 0) {
      setFormError('Select at least one event')
      return
    }

    setLoading('create')

    try {
      const response = await apiFetch('/admin/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          url: url.trim(),
          events: selectedEvents,
          is_active: isActive,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setFormError(data.detail || 'Failed to create webhook')
        return
      }

      setWebhooks((prev) => [data.webhook, ...prev])
      setIsCreateDialogOpen(false)
      setActionSuccess('Webhook created successfully')
      resetForm()

      // Clear success message after 3 seconds
      setTimeout(() => setActionSuccess(null), 3000)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create webhook')
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete() {
    if (!selectedWebhookId) return

    setLoading(selectedWebhookId)
    setActionError(null)

    try {
      const response = await apiFetch(
        `/admin/webhooks?id=${selectedWebhookId}`,
        {
          method: 'DELETE',
        }
      )

      if (!response.ok) {
        const data = await response.json()
        setActionError(data.detail || 'Failed to delete webhook')
        return
      }

      setWebhooks((prev) => prev.filter((w) => w.id !== selectedWebhookId))
      setIsDeleteDialogOpen(false)
      setSelectedWebhookId(null)
      setActionSuccess('Webhook deleted successfully')

      setTimeout(() => setActionSuccess(null), 3000)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete webhook')
    } finally {
      setLoading(null)
    }
  }

  async function handleTest(webhookId: string) {
    setLoading(`test-${webhookId}`)
    setActionError(null)
    setActionSuccess(null)

    try {
      const response = await apiFetch('/admin/webhooks/test', {
        method: 'POST',
        body: JSON.stringify({ webhookId }),
      })

      if (!response.ok) {
        const data = await response.json()
        setActionError(data.detail || 'Test failed')
        return
      }

      setActionSuccess('Test webhook sent successfully')
      setTimeout(() => setActionSuccess(null), 3000)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setLoading(null)
    }
  }

  const formatEventName = (event: string) => {
    const parts = event.split('.')
    return parts
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Webhook Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure webhooks to receive real-time generation event notifications
          </p>
        </div>
        <Button onClick={openCreateDialog} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Webhook
        </Button>
      </div>

      {/* Status Messages */}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {actionError}
          </div>
        </div>
      )}

      {actionSuccess && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4" />
            {actionSuccess}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="text-3xl font-bold tabular-nums">{webhooks.length}</div>
            <div className="text-xs text-muted-foreground">Total Webhooks</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-3xl font-bold tabular-nums text-green-600">
              {webhooks.filter((w) => w.is_active).length}
            </div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-3xl font-bold tabular-nums text-amber-600">
              {webhooks.filter((w) => !w.is_active).length}
            </div>
            <div className="text-xs text-muted-foreground">Inactive</div>
          </CardContent>
        </Card>
      </div>

      {/* Webhooks List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Configured Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-12">
              <Webhook className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No webhooks configured</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                Create a webhook to receive real-time notifications when generations
                change state.
              </p>
              <Button onClick={openCreateDialog} className="mt-6 gap-2">
                <Plus className="h-4 w-4" />
                Create Webhook
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {webhooks.map((webhook) => (
                <div
                  key={webhook.id}
                  className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{webhook.url}</span>
                      <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                        {webhook.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {formatEventName(event)}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Created {new Date(webhook.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(webhook.id)}
                      disabled={loading === `test-${webhook.id}` || !webhook.is_active}
                      className="gap-2"
                    >
                      {loading === `test-${webhook.id}` ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Test
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog(webhook.id)}
                      disabled={loading === webhook.id}
                      className="gap-2"
                    >
                      {loading === webhook.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Webhook</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {formError}
                </div>
              </div>
            )}

            {/* URL Input */}
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                placeholder="https://your-app.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The endpoint that will receive webhook events
              </p>
            </div>

            {/* Events Checkboxes */}
            <div className="space-y-3">
              <Label>Events to Subscribe</Label>
              <div className="space-y-2">
                {VALID_EVENTS.map((event) => (
                  <div key={event} className="flex items-center space-x-2">
                    <Checkbox
                      id={`event-${event}`}
                      checked={selectedEvents.includes(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    <Label
                      htmlFor={`event-${event}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {formatEventName(event)}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="webhook-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <Label htmlFor="webhook-active" className="cursor-pointer">
                Active (enable immediately)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading === 'create'}
              className="gap-2"
            >
              {loading === 'create' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this webhook? This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading === selectedWebhookId}
              className="gap-2"
            >
              {loading === selectedWebhookId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
