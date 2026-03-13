'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import apiFetch from '@/lib/core/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormShell } from './FormShell'

type Option = { value: string; label: string }

type CampaignValues = {
  projectId?: string
  brandKitId?: string
  name: string
  brief: string
  objective: string
  channel: string
  status: 'draft' | 'ready' | 'running' | 'completed' | 'archived'
}

export function CampaignForm({
  mode,
  projectOptions,
  brandKitOptions,
  initialValues,
}: {
  mode: 'create' | 'edit'
  projectOptions: Option[]
  brandKitOptions: Option[]
  initialValues?: Partial<CampaignValues> & { id?: string }
}) {
  const router = useRouter()
  const [values, setValues] = useState<CampaignValues>({
    projectId: initialValues?.projectId,
    brandKitId: initialValues?.brandKitId,
    name: initialValues?.name ?? '',
    brief: initialValues?.brief ?? '',
    objective: initialValues?.objective ?? '',
    channel: initialValues?.channel ?? '',
    status: initialValues?.status ?? 'draft',
  })

  async function submit() {
    const response = await apiFetch(
      mode === 'create' ? '/campaigns' : `/campaigns/${initialValues?.id}`,
      {
        method: mode === 'create' ? 'POST' : 'PUT',
        body: JSON.stringify({
          projectId: values.projectId || undefined,
          brandKitId: values.brandKitId || undefined,
          name: values.name,
          brief: values.brief,
          objective: values.objective || undefined,
          channel: values.channel || undefined,
          status: values.status,
        }),
      }
    )

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.detail || 'Failed to save campaign')
    }

    router.push('/campaigns')
    router.refresh()
  }

  return (
    <FormShell
      title={mode === 'create' ? 'Create campaign' : 'Edit campaign'}
      description="Campaigns turn strategy into a durable generation brief and become the parent record for image and video jobs."
      submitLabel={mode === 'create' ? 'Create campaign' : 'Save campaign'}
      cancelHref="/campaigns"
      onSubmit={submit}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="campaign-name">Name</Label>
          <Input
            id="campaign-name"
            value={values.name}
            onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="March creator acquisition push"
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={values.status}
            onValueChange={(value: CampaignValues['status']) => setValues((prev) => ({ ...prev, status: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              {mode === 'edit' ? (
                <>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>Project</Label>
          <Select
            value={values.projectId ?? '__none__'}
            onValueChange={(value) => setValues((prev) => ({ ...prev, projectId: value === '__none__' ? undefined : value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No linked project</SelectItem>
              {projectOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Brand kit</Label>
          <Select
            value={values.brandKitId ?? '__none__'}
            onValueChange={(value) => setValues((prev) => ({ ...prev, brandKitId: value === '__none__' ? undefined : value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No linked brand kit</SelectItem>
              {brandKitOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="campaign-channel">Platform / channel</Label>
          <Input
            id="campaign-channel"
            value={values.channel}
            onChange={(event) => setValues((prev) => ({ ...prev, channel: event.target.value }))}
            placeholder="TikTok, Instagram Reels, YouTube Shorts"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="campaign-objective">Objective / CTA</Label>
          <Input
            id="campaign-objective"
            value={values.objective}
            onChange={(event) => setValues((prev) => ({ ...prev, objective: event.target.value }))}
            placeholder="Drive signups and demo bookings"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="campaign-brief">Campaign brief</Label>
        <Textarea
          id="campaign-brief"
          rows={8}
          value={values.brief}
          onChange={(event) => setValues((prev) => ({ ...prev, brief: event.target.value }))}
          placeholder="Offer, audience, angle, CTA, platform behavior, duration, aspect ratio, references, and production notes."
        />
      </div>
    </FormShell>
  )
}
