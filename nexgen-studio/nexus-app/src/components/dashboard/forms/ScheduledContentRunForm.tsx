'use client'

import { useEffect, useState } from 'react'
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

type ScheduledContentRunValues = {
  projectId?: string
  brandKitId?: string
  campaignId?: string
  workflowTemplateId?: string
  influencerId?: string
  title: string
  brief: string
  script: string
  frequency: 'daily' | 'weekly'
  dayOfWeek: string
  timeOfDay: string
  timezone: string
  jobsPerRun: string
  provider: string
  jobKind: 'video' | 'image'
  prompt: string
  negativePrompt: string
  batchSize: string
  aspectRatio: string
  durationSeconds: string
}

export function ScheduledContentRunForm({
  mode,
  projectOptions,
  campaignOptions,
  brandKitOptions,
  influencerOptions,
  workflowOptions,
  initialValues,
}: {
  mode: 'create' | 'edit'
  projectOptions: Option[]
  campaignOptions: Option[]
  brandKitOptions: Option[]
  influencerOptions: Option[]
  workflowOptions: Option[]
  initialValues?: Partial<ScheduledContentRunValues> & { id?: string }
}) {
  const router = useRouter()
  const [values, setValues] = useState<ScheduledContentRunValues>({
    projectId: initialValues?.projectId,
    brandKitId: initialValues?.brandKitId,
    campaignId: initialValues?.campaignId,
    workflowTemplateId: initialValues?.workflowTemplateId,
    influencerId: initialValues?.influencerId,
    title: initialValues?.title ?? '',
    brief: initialValues?.brief ?? '',
    script: initialValues?.script ?? '',
    frequency: initialValues?.frequency ?? 'daily',
    dayOfWeek: initialValues?.dayOfWeek ?? '1',
    timeOfDay: initialValues?.timeOfDay ?? '09:00',
    timezone: initialValues?.timezone ?? 'UTC',
    jobsPerRun: initialValues?.jobsPerRun ?? '1',
    provider: initialValues?.provider ?? 'comfyui',
    jobKind: initialValues?.jobKind ?? 'image',
    prompt: initialValues?.prompt ?? '',
    negativePrompt: initialValues?.negativePrompt ?? '',
    batchSize: initialValues?.batchSize ?? '1',
    aspectRatio: initialValues?.aspectRatio ?? '9:16',
    durationSeconds: initialValues?.durationSeconds ?? '10',
  })

  useEffect(() => {
    if (mode !== 'create') {
      return
    }

    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (browserTimezone && browserTimezone !== values.timezone && values.timezone === 'UTC') {
      setValues((current) => ({ ...current, timezone: browserTimezone }))
    }
  }, [mode, values.timezone])

  async function submit() {
    const payload = {
      projectId: values.projectId || undefined,
      brandKitId: values.brandKitId || undefined,
      campaignId: values.campaignId || undefined,
      workflowTemplateId: values.workflowTemplateId || undefined,
      influencerId: values.influencerId || undefined,
      title: values.title,
      brief: values.brief,
      script: values.script || undefined,
      frequency: values.frequency,
      dayOfWeek: values.frequency === 'weekly' ? Number(values.dayOfWeek) : undefined,
      timeOfDay: values.timeOfDay,
      timezone: values.timezone,
      jobsPerRun: Number(values.jobsPerRun || 1),
      provider: values.provider,
      jobKind: values.jobKind,
      inputs: {
        prompt: values.prompt || values.brief,
        negative_prompt: values.negativePrompt || '',
        batch_size: Number(values.batchSize || 1),
        aspect_ratio: values.aspectRatio,
        duration_seconds: Number(values.durationSeconds || 10),
      },
    }

    const response = await apiFetch(
      mode === 'create' ? '/scheduled-content-runs' : `/scheduled-content-runs/${initialValues?.id}`,
      {
        method: mode === 'create' ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      }
    )

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.detail || 'Failed to save schedule')
    }

    const saved = await response.json()
    router.push(saved?.id ? `/schedules/${saved.id}` : '/schedules')
    router.refresh()
  }

  return (
    <FormShell
      title={mode === 'create' ? 'Create recurring content run' : 'Edit recurring content run'}
      description="Recurring content runs create durable image or video jobs on a schedule using saved source context. They reuse the same async job, asset, and accounting backbone as manual runs."
      submitLabel={mode === 'create' ? 'Create schedule' : 'Save schedule'}
      cancelHref="/schedules"
      onSubmit={submit}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="schedule-title">Title</Label>
          <Input
            id="schedule-title"
            value={values.title}
            onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Daily product stills"
          />
        </div>
        <div className="space-y-2">
          <Label>Job kind</Label>
          <Select value={values.jobKind} onValueChange={(value) => setValues((prev) => ({ ...prev, jobKind: value as 'video' | 'image' }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="image">Image</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Project</Label>
          <Select value={values.projectId ?? '__none__'} onValueChange={(value) => setValues((prev) => ({ ...prev, projectId: value === '__none__' ? undefined : value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No linked project</SelectItem>
              {projectOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Campaign</Label>
          <Select value={values.campaignId ?? '__none__'} onValueChange={(value) => setValues((prev) => ({ ...prev, campaignId: value === '__none__' ? undefined : value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No linked campaign</SelectItem>
              {campaignOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Brand kit</Label>
          <Select value={values.brandKitId ?? '__none__'} onValueChange={(value) => setValues((prev) => ({ ...prev, brandKitId: value === '__none__' ? undefined : value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No linked brand kit</SelectItem>
              {brandKitOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <Label>Influencer / creator</Label>
          <Select value={values.influencerId ?? '__none__'} onValueChange={(value) => setValues((prev) => ({ ...prev, influencerId: value === '__none__' ? undefined : value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Choose creator</SelectItem>
              {influencerOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Workflow template</Label>
          <Select value={values.workflowTemplateId ?? '__none__'} onValueChange={(value) => setValues((prev) => ({ ...prev, workflowTemplateId: value === '__none__' ? undefined : value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Choose workflow</SelectItem>
              {workflowOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={values.provider} onValueChange={(value) => setValues((prev) => ({ ...prev, provider: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="comfyui">ComfyUI</SelectItem>
              <SelectItem value="runpod">RunPod</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="schedule-brief">Brief</Label>
        <Textarea
          id="schedule-brief"
          rows={5}
          value={values.brief}
          onChange={(event) => setValues((prev) => ({ ...prev, brief: event.target.value }))}
          placeholder="Audience, offer, channel, CTA, and creative constraints for every recurring run."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="schedule-script">Script / narration</Label>
        <Textarea
          id="schedule-script"
          rows={4}
          value={values.script}
          onChange={(event) => setValues((prev) => ({ ...prev, script: event.target.value }))}
          placeholder="Optional video script or repeatable copy beats."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select value={values.frequency} onValueChange={(value) => setValues((prev) => ({ ...prev, frequency: value as 'daily' | 'weekly' }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Day of week</Label>
          <Select value={values.dayOfWeek} onValueChange={(value) => setValues((prev) => ({ ...prev, dayOfWeek: value }))} disabled={values.frequency !== 'weekly'}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Sunday</SelectItem>
              <SelectItem value="1">Monday</SelectItem>
              <SelectItem value="2">Tuesday</SelectItem>
              <SelectItem value="3">Wednesday</SelectItem>
              <SelectItem value="4">Thursday</SelectItem>
              <SelectItem value="5">Friday</SelectItem>
              <SelectItem value="6">Saturday</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule-time">Preferred time</Label>
          <Input id="schedule-time" type="time" value={values.timeOfDay} onChange={(event) => setValues((prev) => ({ ...prev, timeOfDay: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule-jobs-per-run">Jobs per run</Label>
          <Input id="schedule-jobs-per-run" value={values.jobsPerRun} onChange={(event) => setValues((prev) => ({ ...prev, jobsPerRun: event.target.value }))} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="schedule-timezone">Timezone</Label>
        <Input
          id="schedule-timezone"
          value={values.timezone}
          onChange={(event) => setValues((prev) => ({ ...prev, timezone: event.target.value }))}
          placeholder="Australia/Adelaide"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="schedule-prompt">Generation prompt</Label>
          <Textarea
            id="schedule-prompt"
            rows={4}
            value={values.prompt}
            onChange={(event) => setValues((prev) => ({ ...prev, prompt: event.target.value }))}
            placeholder="Prompt passed into the durable job backbone for each scheduled execution."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule-negative">Negative prompt</Label>
          <Textarea
            id="schedule-negative"
            rows={4}
            value={values.negativePrompt}
            onChange={(event) => setValues((prev) => ({ ...prev, negativePrompt: event.target.value }))}
            placeholder="blurry, low quality, distortion"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="schedule-batch">Batch size</Label>
          <Input id="schedule-batch" value={values.batchSize} onChange={(event) => setValues((prev) => ({ ...prev, batchSize: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule-aspect-ratio">Aspect ratio</Label>
          <Input id="schedule-aspect-ratio" value={values.aspectRatio} onChange={(event) => setValues((prev) => ({ ...prev, aspectRatio: event.target.value }))} placeholder="9:16" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule-duration">Duration seconds</Label>
          <Input id="schedule-duration" value={values.durationSeconds} onChange={(event) => setValues((prev) => ({ ...prev, durationSeconds: event.target.value }))} />
        </div>
      </div>
    </FormShell>
  )
}
