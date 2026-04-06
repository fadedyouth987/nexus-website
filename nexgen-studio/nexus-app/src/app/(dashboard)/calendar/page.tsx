'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import apiFetch from '@/lib/core/api'
import { isPortfolioV2ClientEnabled } from '@/lib/core/featureFlags'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/layout/PageHeader'
import { Loader2, ArrowLeft, Calendar, ListTodo, Share2 } from 'lucide-react'
import { NextStepBanner } from '@/components/layout/NextStepBanner'
import { useWorkspace } from '@/context/WorkspaceContext'
import { cn } from '@/lib/core/utils'

type WorkspaceV2 = {
  id: string
  name: string
}

type ContentV2 = {
  id: string
  type: string
  status: string
  data: Record<string, unknown>
}

type ScheduleV2 = {
  id: string
  content_id: string
  platform: string | null
  scheduled_for: string | null
  status: string
  created_at: string
}

type CalendarPageProps = {
  embedded?: boolean
}

function LegacyCalendarPage({ embedded = false }: CalendarPageProps) {
  const router = useRouter()
  const { status } = useSession()
  const { currentWorkspace } = useWorkspace()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
    }
  }, [status, currentWorkspace, router])

  const message =
    status === 'authenticated' && currentWorkspace
      ? `Legacy calendar remains available for workspace ${currentWorkspace.name}.`
      : 'Loading calendar...'

  return (
    <div className="space-y-[var(--section-gap)]">
      {!embedded && (
        <PageHeader
          title="Scheduler"
          description="Plan when content goes live. Legacy calendar is shown when v2 is disabled."
          breadcrumb={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Automation', href: '/automation' },
            { label: 'Scheduler' },
          ]}
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          }
        />
      )}
      <Card className={cn('border-border', !embedded && 'mt-8')}>
        <CardHeader>
          <CardTitle className="text-foreground">Content Calendar</CardTitle>
          <CardDescription className="text-muted-foreground">
            Legacy calendar flow is preserved while v2 is feature-flagged.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-foreground">{message}</CardContent>
      </Card>
    </div>
  )
}

function CalendarV2Page({ embedded = false }: CalendarPageProps) {
  const { status } = useSession()
  const router = useRouter()
  const { currentWorkspace, setCurrentWorkspace } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceV2[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('')
  const [content, setContent] = useState<ContentV2[]>([])
  const [schedules, setSchedules] = useState<ScheduleV2[]>([])
  const [selectedContentId, setSelectedContentId] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [scheduledFor, setScheduledFor] = useState('')
  const [updatingScheduleId, setUpdatingScheduleId] = useState<string | null>(null)

  const loadWorkspaceData = useCallback(async (workspaceId: string) => {
    setLoading(true)
    setError(null)

    try {
      const [contentResponse, scheduleResponse] = await Promise.all([
        apiFetch(`/content?workspace_id=${workspaceId}`),
        apiFetch(`/schedules?workspace_id=${workspaceId}`),
      ])

      if (!contentResponse.ok) {
        const payload = await contentResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load content')
      }

      if (!scheduleResponse.ok) {
        const payload = await scheduleResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load schedules')
      }

      const contentPayload = (await contentResponse.json()) as { items: ContentV2[] }
      const schedulePayload = (await scheduleResponse.json()) as { items: ScheduleV2[] }

      setContent(contentPayload.items || [])
      setSchedules(schedulePayload.items || [])

      const scheduleableContent = (contentPayload.items || []).filter((item) =>
        ['draft', 'internal_review', 'client_review', 'scheduled'].includes(item.status)
      )
      setSelectedContentId((current) =>
        current && scheduleableContent.some((item) => item.id === current)
          ? current
          : scheduleableContent[0]?.id || ''
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }, [])

  const boot = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const workspaceResponse = await apiFetch('/workspaces')
      if (!workspaceResponse.ok) {
        const payload = await workspaceResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load workspaces')
      }

      const workspaceRows = (await workspaceResponse.json()) as WorkspaceV2[]
      setWorkspaces(workspaceRows)

      if (workspaceRows.length > 0) {
        const preferredWorkspace =
          (currentWorkspace && workspaceRows.find((workspace) => workspace.id === currentWorkspace.id)) ||
          workspaceRows[0]
        setSelectedWorkspaceId(preferredWorkspace.id)
        setCurrentWorkspace(preferredWorkspace)
      } else {
        setContent([])
        setSchedules([])
        setCurrentWorkspace(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }, [currentWorkspace, setCurrentWorkspace])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }

    if (status === 'authenticated') {
      void boot()
    }
  }, [status, router, boot])

  useEffect(() => {
    if (selectedWorkspaceId) {
      void loadWorkspaceData(selectedWorkspaceId)
    }
  }, [selectedWorkspaceId, loadWorkspaceData])

  useEffect(() => {
    if (currentWorkspace?.id && currentWorkspace.id !== selectedWorkspaceId) {
      setSelectedWorkspaceId(currentWorkspace.id)
    }
  }, [currentWorkspace?.id, selectedWorkspaceId])

  const createSchedule = async () => {
    if (!selectedWorkspaceId || !selectedContentId || !scheduledFor) {
      setError('Select content and a schedule time first')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const response = await apiFetch(`/schedules?workspace_id=${selectedWorkspaceId}`, {
        method: 'POST',
        body: JSON.stringify({
          content_id: selectedContentId,
          platform,
          scheduled_for: new Date(scheduledFor).toISOString(),
          status: 'scheduled',
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to create schedule')
      }

      setScheduledFor('')
      await loadWorkspaceData(selectedWorkspaceId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create schedule')
    } finally {
      setSaving(false)
    }
  }

  const refreshScheduleAndContent = async (workspaceId: string, scheduleId: string, contentId: string) => {
    const [scheduleResponse, contentResponse] = await Promise.all([
      apiFetch(`/schedules?workspace_id=${workspaceId}&id=${scheduleId}`),
      apiFetch(`/content?workspace_id=${workspaceId}&id=${contentId}`),
    ])

    if (scheduleResponse.ok) {
      const schedulePayload = (await scheduleResponse.json()) as { items: ScheduleV2[] }
      const freshSchedule = schedulePayload.items?.[0]
      if (freshSchedule) {
        setSchedules((current) =>
          current.map((item) => (item.id === freshSchedule.id ? freshSchedule : item))
        )
      }
    }

    if (contentResponse.ok) {
      const contentPayload = (await contentResponse.json()) as { items: ContentV2[] }
      const freshContent = contentPayload.items?.[0]
      if (freshContent) {
        setContent((current) =>
          current.some((item) => item.id === freshContent.id)
            ? current.map((item) => (item.id === freshContent.id ? freshContent : item))
            : [freshContent, ...current]
        )
      }
    }
  }

  const updateScheduleStatus = async (schedule: ScheduleV2, nextStatus: 'published' | 'canceled' | 'failed') => {
    if (!selectedWorkspaceId || updatingScheduleId) {
      return
    }

    setError(null)
    setUpdatingScheduleId(schedule.id)
    const previousSchedules = schedules

    setSchedules((current) =>
      current.map((item) => (item.id === schedule.id ? { ...item, status: nextStatus } : item))
    )

    try {
      const response = await apiFetch(`/schedules?workspace_id=${selectedWorkspaceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          id: schedule.id,
          status: nextStatus,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to update schedule')
      }

      const payload = (await response.json()) as {
        schedule?: ScheduleV2
        content?: ContentV2
      }

      if (payload.schedule) {
        setSchedules((current) =>
          current.map((item) => (item.id === payload.schedule!.id ? payload.schedule! : item))
        )
      }

      if (payload.content) {
        setContent((current) =>
          current.some((item) => item.id === payload.content!.id)
            ? current.map((item) => (item.id === payload.content!.id ? payload.content! : item))
            : [payload.content!, ...current]
        )
      }

      await refreshScheduleAndContent(selectedWorkspaceId, schedule.id, schedule.content_id)
    } catch (err) {
      setSchedules(previousSchedules)
      setError(err instanceof Error ? err.message : 'Failed to update schedule')
    } finally {
      setUpdatingScheduleId(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className={cn('flex items-center justify-center', embedded ? 'min-h-[360px]' : 'min-h-screen')}>
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className={cn('flex items-center justify-center p-8 text-sm text-muted-foreground', embedded ? 'min-h-[260px]' : 'min-h-screen')}>
        Redirecting to login...
      </div>
    )
  }

  return (
    <div className="space-y-[var(--section-gap)]">
      {!embedded && (
        <PageHeader
          title="Scheduler"
          description="Plan when content goes live for each influencer and platform. Create schedule entries and manage the queue from this workspace."
          breadcrumb={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: 'Automation', href: '/automation' },
            { label: 'Scheduler' },
          ]}
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to dashboard
              </Link>
            </Button>
          }
        />
      )}

      {error ? (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Week View</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const today = new Date()
                const startOfWeek = new Date(today)
                startOfWeek.setDate(today.getDate() - today.getDay())
                const days: Date[] = []
                for (let i = 0; i < 7; i++) {
                  const d = new Date(startOfWeek)
                  d.setDate(startOfWeek.getDate() + i)
                  days.push(d)
                }
                return days.map((day) => {
                  const dayStr = day.toISOString().slice(0, 10)
                  const isToday = dayStr === today.toISOString().slice(0, 10)
                  const daySchedules = schedules.filter((s) =>
                    s.scheduled_for && s.scheduled_for.startsWith(dayStr)
                  )
                  return (
                    <div key={dayStr} className={cn(
                      'min-h-[100px] rounded-lg border p-2',
                      isToday ? 'border-primary/40 bg-primary/5' : 'border-border'
                    )}>
                      <div className={cn('text-xs font-medium mb-1', isToday ? 'text-primary' : 'text-muted-foreground')}>
                        {day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                      </div>
                      <div className="space-y-1">
                        {daySchedules.map((s) => {
                          const mc = content.find((c) => c.id === s.content_id)
                          const title = (mc && typeof mc.data?.title === 'string' && mc.data.title) || mc?.type || 'Content'
                          return (
                            <div key={s.id} className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] truncate',
                              s.status === 'published' ? 'bg-emerald-500/10 text-emerald-700' :
                              s.status === 'canceled' ? 'bg-muted text-muted-foreground line-through' :
                              'bg-primary/10 text-primary'
                            )}>
                              {title}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      <div className={cn('grid gap-6 lg:grid-cols-[1fr_1.35fr]', !embedded && 'mt-8')}>
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              Create Schedule
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Pick content and set the date and platform. Schedules appear in the queue and can be marked published or canceled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Workspace</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={selectedWorkspaceId}
                onChange={(event) => {
                  const nextWorkspaceId = event.target.value
                  setSelectedWorkspaceId(nextWorkspaceId)
                  const selectedWorkspace = workspaces.find((workspace) => workspace.id === nextWorkspaceId)
                  setCurrentWorkspace(selectedWorkspace || null)
                }}
              >
                <option value="">Select workspace</option>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Content</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={selectedContentId}
                onChange={(event) => setSelectedContentId(event.target.value)}
              >
                <option value="">Select content</option>
                {content
                  .filter((item) => ['draft', 'internal_review', 'client_review', 'scheduled'].includes(item.status))
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {(typeof item.data?.title === 'string' && item.data.title) || item.type} ({item.status})
                    </option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Only draft and review content can be scheduled.</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Platform</label>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                value={platform}
                onChange={(event) => setPlatform(event.target.value)}
              >
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="twitter">X</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-foreground">Scheduled for</label>
              <Input
                type="datetime-local"
                className="border-border bg-background text-foreground"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Date and time when the post should go live.</p>
            </div>

            <Button onClick={() => void createSchedule()} disabled={saving || !selectedContentId || !scheduledFor}>
              {saving ? 'Saving...' : 'Create Schedule'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <ListTodo className="h-5 w-5 text-muted-foreground" />
              Scheduled Queue
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              All scheduled items for the current workspace. Update status when content is published or if you need to cancel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {schedules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 py-10 text-center">
                <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">No schedules yet for this workspace.</p>
                <p className="text-xs text-muted-foreground mt-1">Create one using the form on the left.</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {schedules.map((schedule) => {
                  const matchingContent = content.find((item) => item.id === schedule.content_id)
                  const title =
                    (matchingContent && typeof matchingContent.data?.title === 'string' && matchingContent.data.title) ||
                    matchingContent?.type ||
                    schedule.content_id
                  const contentRating =
                    matchingContent && matchingContent.data && typeof matchingContent.data === 'object'
                      ? String((matchingContent.data as Record<string, unknown>).content_rating || 'sfw').toLowerCase()
                      : 'sfw'

                  return (
                    <li key={schedule.id} className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                      <div className="font-medium text-foreground">{title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Platform: {schedule.platform || '—'} · Rating: {contentRating.toUpperCase()} · Status: {schedule.status}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {schedule.scheduled_for
                          ? new Date(schedule.scheduled_for).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'No time set'}
                        {' · '}
                        Content status: {matchingContent?.status || 'Unknown'}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingScheduleId === schedule.id || schedule.status === 'published'}
                          onClick={() => void updateScheduleStatus(schedule, 'published')}
                        >
                          Mark Published
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingScheduleId === schedule.id || schedule.status === 'canceled'}
                          onClick={() => void updateScheduleStatus(schedule, 'canceled')}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingScheduleId === schedule.id || schedule.status === 'failed'}
                          onClick={() => void updateScheduleStatus(schedule, 'failed')}
                        >
                          Mark Failed
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {!embedded && (
        <NextStepBanner currentPhase={5} nextLabel="Connect socials" nextHref="/socials" nextIcon={Share2} />
      )}
    </div>
  )
}

export default function CalendarPage({ embedded = false }: CalendarPageProps) {
  return isPortfolioV2ClientEnabled()
    ? <CalendarV2Page embedded={embedded} />
    : <LegacyCalendarPage embedded={embedded} />
}
