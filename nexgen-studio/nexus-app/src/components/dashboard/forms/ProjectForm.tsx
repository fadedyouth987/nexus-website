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

type ProjectFormValues = {
  name: string
  description: string
  objective: string
  status: 'draft' | 'active' | 'archived'
}

export function ProjectForm({
  mode,
  initialValues,
}: {
  mode: 'create' | 'edit'
  initialValues?: Partial<ProjectFormValues> & { id?: string }
}) {
  const router = useRouter()
  const [values, setValues] = useState<ProjectFormValues>({
    name: initialValues?.name ?? '',
    description: initialValues?.description ?? '',
    objective: initialValues?.objective ?? '',
    status: initialValues?.status ?? 'draft',
  })

  async function submit() {
    const response = await apiFetch(
      mode === 'create' ? '/projects' : `/projects/${initialValues?.id}`,
      {
        method: mode === 'create' ? 'POST' : 'PUT',
        body: JSON.stringify(values),
      }
    )

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      throw new Error(payload.detail || 'Failed to save project')
    }

    router.push('/projects')
    router.refresh()
  }

  return (
    <FormShell
      title={mode === 'create' ? 'Create project' : 'Edit project'}
      description="Projects are the root record for briefs, brand systems, jobs, and future recurring runs."
      submitLabel={mode === 'create' ? 'Create project' : 'Save project'}
      cancelHref="/projects"
      onSubmit={submit}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="project-name">Name</Label>
          <Input
            id="project-name"
            value={values.name}
            onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Launch Q2 AI creator campaign"
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={values.status}
            onValueChange={(value: ProjectFormValues['status']) => setValues((prev) => ({ ...prev, status: value }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              {mode === 'edit' ? <SelectItem value="archived">Archived</SelectItem> : null}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          rows={4}
          value={values.description}
          onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Short context for the initiative, audience, and offer."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-objective">Objective</Label>
        <Textarea
          id="project-objective"
          rows={3}
          value={values.objective}
          onChange={(event) => setValues((prev) => ({ ...prev, objective: event.target.value }))}
          placeholder="What should this project drive: signups, revenue, awareness, or content volume?"
        />
      </div>
    </FormShell>
  )
}
