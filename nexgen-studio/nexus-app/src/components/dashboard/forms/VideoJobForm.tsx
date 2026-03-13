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

type VideoJobValues = {
  jobKind: 'video' | 'image'
  projectId?: string
  campaignId?: string
  brandKitId?: string
  title: string
  brief: string
  script: string
  provider: string
  workflowTemplateId?: string
  influencerId?: string
  prompt: string
  negativePrompt: string
  batchSize: string
  aspectRatio: string
  durationSeconds: string
}

export function VideoJobForm({
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
  initialValues?: Partial<VideoJobValues> & { id?: string }
}) {
  const router = useRouter()
  const [values, setValues] = useState<VideoJobValues>({
    jobKind: initialValues?.jobKind ?? 'video',
    projectId: initialValues?.projectId,
    campaignId: initialValues?.campaignId,
    brandKitId: initialValues?.brandKitId,
    title: initialValues?.title ?? '',
    brief: initialValues?.brief ?? '',
    script: initialValues?.script ?? '',
    provider: initialValues?.provider ?? 'comfyui',
    workflowTemplateId: initialValues?.workflowTemplateId,
    influencerId: initialValues?.influencerId,
    prompt: initialValues?.prompt ?? '',
    negativePrompt: initialValues?.negativePrompt ?? '',
    batchSize: initialValues?.batchSize ?? '1',
    aspectRatio: initialValues?.aspectRatio ?? '9:16',
    durationSeconds: initialValues?.durationSeconds ?? '10',
  })

  async function submit() {
    const payload = {
      jobKind: values.jobKind,
      projectId: values.projectId || undefined,
      campaignId: values.campaignId || undefined,
      brandKitId: values.brandKitId || undefined,
      title: values.title,
      brief: values.brief,
      script: values.script || undefined,
      provider: values.provider,
      workflowTemplateId: values.workflowTemplateId || undefined,
      influencerId: values.influencerId || undefined,
      inputs: {
        prompt: values.prompt || values.brief,
        negative_prompt: values.negativePrompt || '',
        batch_size: Number(values.batchSize || 1),
        aspect_ratio: values.aspectRatio,
        duration_seconds: Number(values.durationSeconds || 10),
      },
    }

    const response = await apiFetch(
      mode === 'create' ? '/video-jobs' : `/video-jobs/${initialValues?.id}`,
      {
        method: mode === 'create' ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      }
    )

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.detail || 'Failed to save generation job')
    }

    const saved = await response.json()
    const nextId = saved?.job?.id || saved?.id
    router.push(nextId ? `/video-jobs/${nextId}` : '/video-jobs')
    router.refresh()
  }

  return (
    <FormShell
      title={mode === 'create' ? 'Create generation job' : 'Edit generation job'}
      description="Generation jobs are the async execution record for image and video runs. They should point back to a project, campaign, and compatible workflow."
      submitLabel={mode === 'create' ? 'Submit generation job' : 'Save generation job'}
      cancelHref="/video-jobs"
      onSubmit={submit}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="video-job-title">Title</Label>
          <Input
            id="video-job-title"
            value={values.title}
            onChange={(event) => setValues((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="UGC launch video variant A"
          />
        </div>
        <div className="space-y-2">
          <Label>Job kind</Label>
          <Select value={values.jobKind} onValueChange={(value) => setValues((prev) => ({ ...prev, jobKind: value as 'video' | 'image' }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="image">Image</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={values.provider} onValueChange={(value) => setValues((prev) => ({ ...prev, provider: value }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comfyui">ComfyUI</SelectItem>
              <SelectItem value="runpod">RunPod</SelectItem>
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

      <div className="grid gap-6 lg:grid-cols-2">
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="video-job-brief">Brief</Label>
        <Textarea
          id="video-job-brief"
          rows={5}
          value={values.brief}
          onChange={(event) => setValues((prev) => ({ ...prev, brief: event.target.value }))}
          placeholder="Offer, audience, platform, visual references, CTA, and what success looks like."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="video-job-script">Script / narration</Label>
        <Textarea
          id="video-job-script"
          rows={4}
          value={values.script}
          onChange={(event) => setValues((prev) => ({ ...prev, script: event.target.value }))}
          placeholder="Optional script or spoken beats for video-oriented workflows."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="video-job-prompt">Generation prompt</Label>
          <Textarea
            id="video-job-prompt"
            rows={4}
            value={values.prompt}
            onChange={(event) => setValues((prev) => ({ ...prev, prompt: event.target.value }))}
            placeholder="Prompt passed into the generation backbone."
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="video-job-negative">Negative prompt</Label>
          <Textarea
            id="video-job-negative"
            rows={4}
            value={values.negativePrompt}
            onChange={(event) => setValues((prev) => ({ ...prev, negativePrompt: event.target.value }))}
            placeholder="blurry, low quality, distortion"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="video-job-batch">Batch size</Label>
          <Input id="video-job-batch" value={values.batchSize} onChange={(event) => setValues((prev) => ({ ...prev, batchSize: event.target.value }))} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="video-job-ratio">Aspect ratio</Label>
          <Input id="video-job-ratio" value={values.aspectRatio} onChange={(event) => setValues((prev) => ({ ...prev, aspectRatio: event.target.value }))} placeholder="9:16" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="video-job-duration">Duration seconds (video only)</Label>
          <Input id="video-job-duration" value={values.durationSeconds} onChange={(event) => setValues((prev) => ({ ...prev, durationSeconds: event.target.value }))} />
        </div>
      </div>
    </FormShell>
  )
}
