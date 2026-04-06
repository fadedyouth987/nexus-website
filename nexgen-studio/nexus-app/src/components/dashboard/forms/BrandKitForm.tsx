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

type BrandKitValues = {
  projectId?: string
  name: string
  tone: string
  palette: string
  typography: string
  voiceGuidelines: string
}

export function BrandKitForm({
  mode,
  projectOptions,
  initialValues,
}: {
  mode: 'create' | 'edit'
  projectOptions: Option[]
  initialValues?: Partial<BrandKitValues> & { id?: string }
}) {
  const router = useRouter()
  const [values, setValues] = useState<BrandKitValues>({
    projectId: initialValues?.projectId,
    name: initialValues?.name ?? '',
    tone: initialValues?.tone ?? '',
    palette: initialValues?.palette ?? '',
    typography: initialValues?.typography ?? '',
    voiceGuidelines: initialValues?.voiceGuidelines ?? '',
  })

  async function submit() {
    const payload = {
      projectId: values.projectId || undefined,
      name: values.name,
      tone: values.tone || undefined,
      palette: values.palette.split(',').map((item) => item.trim()).filter(Boolean),
      typography: values.typography.split(',').map((item) => item.trim()).filter(Boolean),
      voiceGuidelines: values.voiceGuidelines || undefined,
    }

    const response = await apiFetch(
      mode === 'create' ? '/brand-kits' : `/brand-kits/${initialValues?.id}`,
      {
        method: mode === 'create' ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      }
    )

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.detail || 'Failed to save brand kit')
    }

    router.push('/brand-kits')
    router.refresh()
  }

  return (
    <FormShell
      title={mode === 'create' ? 'Create brand kit' : 'Edit brand kit'}
      description="Brand kits centralize tone, style, and visual rules so every campaign and generation request stays aligned."
      submitLabel={mode === 'create' ? 'Create brand kit' : 'Save brand kit'}
      cancelHref="/brand-kits"
      onSubmit={submit}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brand-kit-name">Name</Label>
          <Input
            id="brand-kit-name"
            value={values.name}
            onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Premium creator launch kit"
          />
        </div>
        <div className="space-y-2">
          <Label>Project</Label>
          <Select
            value={values.projectId ?? '__none__'}
            onValueChange={(value) => setValues((prev) => ({ ...prev, projectId: value === '__none__' ? undefined : value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Optional project" />
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand-kit-tone">Brand voice / tone</Label>
        <Input
          id="brand-kit-tone"
          value={values.tone}
          onChange={(event) => setValues((prev) => ({ ...prev, tone: event.target.value }))}
          placeholder="Confident, premium, direct, creator-first"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brand-kit-palette">Primary colors</Label>
          <Input
            id="brand-kit-palette"
            value={values.palette}
            onChange={(event) => setValues((prev) => ({ ...prev, palette: event.target.value }))}
            placeholder="#0f172a, #0ea5e9, #f8fafc"
          />
          <p className="text-xs text-muted-foreground">Comma-separated values.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-kit-type">Typography / style fields</Label>
          <Input
            id="brand-kit-type"
            value={values.typography}
            onChange={(event) => setValues((prev) => ({ ...prev, typography: event.target.value }))}
            placeholder="Satoshi, space grotesk, high contrast layouts"
          />
          <p className="text-xs text-muted-foreground">Comma-separated values.</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="brand-kit-guidelines">Visual guidance / voice guidelines</Label>
        <Textarea
          id="brand-kit-guidelines"
          rows={5}
          value={values.voiceGuidelines}
          onChange={(event) => setValues((prev) => ({ ...prev, voiceGuidelines: event.target.value }))}
          placeholder="Preferred hooks, framing style, camera feel, CTA language, and what to avoid."
        />
      </div>
    </FormShell>
  )
}
