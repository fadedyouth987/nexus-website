'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModelUploadPanel } from './ModelUploadPanel'
import { StudioGenerationControls, type StudioGenerationControlsRef } from './StudioGenerationControls'
import { LayoutGrid, ListTree, Search, Eye, Play, PanelBottomClose, PanelBottomOpen, Pencil, ImageIcon, Loader2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/core/utils'
import apiFetch from '@/lib/core/api'
import { useWorkspace } from '@/context/WorkspaceContext'
import { generationOutputLimitByPlan, normalizePlan } from '@/lib/billing/planLimits'
import { AppHero } from '@/components/layout/AppHero'

type FlowStep = 'look' | 'personality' | 'scenes' | 'output' | 'generation'

const FLOW_STEPS: { id: FlowStep; title: string }[] = [
  { id: 'generation', title: 'Generation (Comfy)' },
  { id: 'look', title: 'Look & Lore' },
  { id: 'personality', title: 'Personality & Voice' },
  { id: 'scenes', title: 'Scenes & Shots' },
  { id: 'output', title: 'Output & Platforms' },
]

const WORKFLOW_PRESETS = [
  { id: 'sd1', name: 'SD 1.0 Image', type: 'Image', modelId: 'sd1' as const },
  { id: 'sd15', name: 'SD 1.5 Image', type: 'Image', modelId: 'sd15' as const },
  { id: 'sdxl', name: 'SDXL Image', type: 'Image', modelId: 'sdxl' as const },
  { id: 'flux', name: 'FLUX Image', type: 'Image', modelId: 'flux' as const },
  { id: 'animatediff', name: 'AnimateDiff Video', type: 'Video', modelId: 'sdxl' as const },
  { id: 'kling', name: 'Kling Video', type: 'Video', modelId: 'kling' as const },
  { id: 'nano', name: 'Luma Nano', type: 'Video', modelId: 'nano' as const },
  { id: 'banana', name: 'Banana Video', type: 'Video', modelId: 'banana' as const },
]

const IMAGE_WORKFLOW_IDS = ['sd1', 'sd15', 'sdxl', 'flux']

const PROMPT_PRESETS_KEY = 'nexus-studio-prompt-presets'
type PromptPreset = { id: string; name: string; prompt: string; negativePrompt: string }

function loadPromptPresets(): PromptPreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(PROMPT_PRESETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((p): p is PromptPreset => p && typeof p === 'object' && typeof (p as PromptPreset).id === 'string' && typeof (p as PromptPreset).name === 'string') : []
  } catch {
    return []
  }
}

function savePromptPresets(presets: PromptPreset[]) {
  try {
    window.localStorage.setItem(PROMPT_PRESETS_KEY, JSON.stringify(presets))
  } catch { /* ignore */ }
}

type WorkflowTemplate = { id: string; slug: string; name: string; type: 'IMAGE' | 'VIDEO'; base_cost_credits?: number | null }
type Influencer = { id: string; name?: string | null; display_name?: string | null }
type JobProgress = { status: 'idle' | 'queued' | 'running'; percent?: number; message?: string }
type BillingPayload = { plan?: string | null }

export default function StudioPage() {
  const { currentWorkspace } = useWorkspace()
  const controlsRef = useRef<StudioGenerationControlsRef>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const [activeStep, setActiveStep] = useState<FlowStep>('generation')
  const [leftTab, setLeftTab] = useState<'library' | 'navigator'>('navigator')
  const [bottomOpen, setBottomOpen] = useState(false)
  const [bottomTab, setBottomTab] = useState<'log' | 'queue'>('log')
  const [libraryFilter, setLibraryFilter] = useState('')
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(WORKFLOW_PRESETS[0]!.id)
  const [customWorkflowJson, setCustomWorkflowJson] = useState<Record<string, unknown> | null>(null)
  const [customWorkflowName, setCustomWorkflowName] = useState<string>('')
  const [workflowUploadError, setWorkflowUploadError] = useState<string | null>(null)
  const workflowFileInputRef = useRef<HTMLInputElement>(null)

  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([])
  const [selectedInfluencerId, setSelectedInfluencerId] = useState<string>('')
  const [selectedWorkflowTemplateId, setSelectedWorkflowTemplateId] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [jobProgress, setJobProgress] = useState<JobProgress>({ status: 'idle' })
  const [logLines, setLogLines] = useState<string[]>(['Ready. Select a workflow and click Generate.'])
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [planTier, setPlanTier] = useState<string>('STARTER')
  const [batchLimit, setBatchLimit] = useState<number>(generationOutputLimitByPlan('STARTER'))
  const [promptPresets, setPromptPresets] = useState<PromptPreset[]>([])
  const [presetNameInput, setPresetNameInput] = useState('')
  useEffect(() => {
    setPromptPresets(loadPromptPresets())
  }, [])

  function handleWorkflowFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setWorkflowUploadError(null)
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        const parsed = JSON.parse(text) as Record<string, unknown>
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setCustomWorkflowJson(parsed)
          setCustomWorkflowName(file.name.replace(/\.json$/i, '') || 'Custom workflow')
          setSelectedWorkflowId('custom')
        } else {
          setWorkflowUploadError('Invalid workflow: root must be an object')
        }
      } catch {
        setWorkflowUploadError('Invalid JSON file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  useEffect(() => {
    if (!currentWorkspace?.id) return
    let cancelled = false
    Promise.all([
      apiFetch(`/workspaces/${currentWorkspace.id}/influencers`),
      apiFetch('/workflow-templates'),
      apiFetch('/billing/me'),
    ]).then(([infRes, wfRes, billingRes]) => {
      if (cancelled) return
      if (infRes.ok) {
        infRes.json().then((data: Influencer[]) => {
          if (!cancelled) {
            setInfluencers(Array.isArray(data) ? data : [])
            if (!selectedInfluencerId && Array.isArray(data) && data[0]) setSelectedInfluencerId(data[0].id)
          }
        }).catch(() => {})
      }
      if (wfRes.ok) {
        wfRes.json().then((payload: { items?: WorkflowTemplate[] } | WorkflowTemplate[]) => {
          if (!cancelled) {
            const items = Array.isArray(payload) ? payload : payload?.items ?? []
            setWorkflows(items)
          }
        }).catch(() => {})
      }
      if (billingRes.ok) {
        billingRes
          .json()
          .then((payload: BillingPayload) => {
            if (cancelled) return
            const normalized = normalizePlan(payload?.plan)
            setPlanTier(normalized)
            setBatchLimit(generationOutputLimitByPlan(normalized))
          })
          .catch(() => {})
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [currentWorkspace?.id])

  useEffect(() => {
    if (influencers.length && !selectedInfluencerId) setSelectedInfluencerId(influencers[0].id)
  }, [influencers, selectedInfluencerId])

  const closeProgressStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  const handleGenerate = useCallback(async () => {
    const values = controlsRef.current?.getValues()
    const prompt = values?.prompt?.trim() ?? ''
    const requestedOutputs = Math.max(1, Math.floor(values?.outputCount ?? 1))
    if (!prompt) {
      setGenError('Enter a positive prompt.')
      setBottomOpen(true)
      setBottomTab('log')
      return
    }
    const mode = IMAGE_WORKFLOW_IDS.includes(selectedWorkflowId) ? 'IMAGE' : 'VIDEO'
    const template = selectedWorkflowTemplateId
      ? workflows.find((w) => w.id === selectedWorkflowTemplateId)
      : workflows.find((w) => w.type === mode)
    if (!template) {
      setGenError('No workflow template found for this type. Add one in Supabase workflow_templates.')
      setBottomOpen(true)
      return
    }
    if (!selectedInfluencerId) {
      setGenError('Select an influencer (or connect a workspace with creators).')
      setBottomOpen(true)
      return
    }
    if (requestedOutputs > batchLimit) {
      setGenError(`Your ${planTier} plan allows up to ${batchLimit} outputs per generation request.`)
      setBottomOpen(true)
      setBottomTab('log')
      return
    }
    setGenerating(true)
    setGenError(null)
    setJobProgress({ status: 'queued', message: 'Queued…' })
    setLogLines((prev) => [
      ...prev,
      `Starting generation (${template.name}, ${requestedOutputs} output${requestedOutputs === 1 ? '' : 's'})…`,
    ])
    setBottomOpen(true)
    setBottomTab('log')
    closeProgressStream()
    try {
      const res = await apiFetch('/generate', {
        method: 'POST',
        body: JSON.stringify({
          influencerId: selectedInfluencerId,
          workflowTemplateId: template.id,
          mode: template.type,
          inputs: {
            prompt,
            negative_prompt: values?.negativePrompt?.trim() ?? '',
            batch_size: requestedOutputs,
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail || 'Failed to start generation')
      }
      const body = (await res.json()) as { jobId: string }
      const id = body.jobId
      setJobId(id)
      setJobProgress({ status: 'running', percent: 0, message: 'Starting…' })
      setLogLines((prev) => [...prev, `Job ${id} queued. Listening for progress…`])
      const eventSource = new EventSource(`/api/generate/${id}/events`)
      eventSourceRef.current = eventSource
      eventSource.addEventListener('snapshot', (e: MessageEvent<string>) => {
        try {
          const data = JSON.parse(e.data) as { job?: { status?: string; progress_json?: { status?: string; percent?: number; message?: string } } }
          const status = data?.job?.status
          const progress = data?.job?.progress_json
          setLogLines((prev) => [...prev, `Status: ${status ?? 'unknown'}`])
          if (progress && typeof progress === 'object') {
            setJobProgress({
              status: 'running',
              percent: typeof progress.percent === 'number' ? progress.percent : undefined,
              message: typeof progress.message === 'string' ? progress.message : undefined,
            })
          }
          if (status === 'READY' || status === 'FAILED') {
            setJobProgress({ status: 'idle' })
            closeProgressStream()
            setGenerating(false)
          }
        } catch { /* ignore */ }
      })
      eventSource.addEventListener('progress', (e: MessageEvent<string>) => {
        try {
          const data = JSON.parse(e.data) as { percent?: number; message?: string; status?: string }
          setLogLines((prev) => [...prev, `Progress: ${data?.percent ?? 0}%${data?.message ? ` – ${data.message}` : ''}`])
          setJobProgress((prev) => ({
            ...prev,
            status: 'running',
            percent: typeof data.percent === 'number' ? data.percent : prev.percent,
            message: typeof data.message === 'string' ? data.message : prev.message,
          }))
        } catch { /* ignore */ }
      })
      eventSource.addEventListener('status', (e: MessageEvent<string>) => {
        try {
          const data = JSON.parse(e.data) as { status?: string; message?: string }
          setLogLines((prev) => [...prev, `Status: ${data?.status ?? 'unknown'}${data?.message ? ` – ${data.message}` : ''}`])
          if (data?.status === 'FAILED' && data?.message) {
            setGenError(data.message)
          }
          if (data?.status === 'READY' || data?.status === 'FAILED') {
            setJobProgress({ status: 'idle' })
            closeProgressStream()
            setGenerating(false)
          }
        } catch { /* ignore */ }
      })
      eventSource.onerror = () => {
        setJobProgress({ status: 'idle' })
        closeProgressStream()
        setGenerating(false)
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
      setLogLines((prev) => [...prev, `Error: ${err instanceof Error ? err.message : 'Unknown'}`])
      setGenerating(false)
    }
  }, [
    selectedWorkflowId,
    workflows,
    selectedInfluencerId,
    selectedWorkflowTemplateId,
    closeProgressStream,
    batchLimit,
    planTier,
  ])

  useEffect(() => () => closeProgressStream(), [closeProgressStream])

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Studio"
        title="Generate, direct, and refine in one surface"
        description="The Studio now uses the same visual language as the rest of the product while keeping the high-density workflow intact. Move from prompts to previews to generated output without leaving the shell."
        actions={
          <>
            <Button asChild size="lg">
              <Link href="/creators/create">Create creator</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/gallery">Open gallery</Link>
            </Button>
          </>
        }
        metrics={[
          { label: 'Workspace', value: currentWorkspace?.name || 'Unselected' },
          { label: 'Plan tier', value: planTier },
          { label: 'Output limit', value: `${batchLimit} max` },
        ]}
        media={
          <Image
            src="/app/studio-motion.svg"
            alt="Studio workflow artwork"
            width={1400}
            height={980}
            unoptimized
            className="h-auto w-full rounded-[24px]"
          />
        }
      />

      <div className="app-shell-panel flex min-h-[60vh] flex-col overflow-hidden">
      {/* Top toolbar: format, view, NSFW toggle, primary action */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground"
            defaultValue="reel"
          >
            <option value="reel">TikTok Reel</option>
            <option value="story">Instagram Story</option>
            <option value="short">YouTube Short</option>
            <option value="custom">Custom</option>
          </select>
          <span className="text-xs text-muted-foreground">100%</span>
          <Button variant="secondary" size="sm">
            Preview
          </Button>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Switch defaultChecked={false} />
            NSFW (gated)
          </label>
          {jobProgress.status !== 'idle' && (
            <span className="text-xs text-muted-foreground">
              {jobProgress.status === 'queued' && 'Queued'}
              {jobProgress.status === 'running' && (
                jobProgress.percent != null ? `Rendering ${jobProgress.percent}%` : (jobProgress.message || 'Running…')
              )}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            Plan {planTier}: {batchLimit} output{batchLimit === 1 ? '' : 's'} max
          </span>
        </div>
        <Button size="sm" className="gap-2" onClick={handleGenerate} disabled={generating}>
          {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Generate
        </Button>
      </div>

      {/* Main three-column area */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel: Library + Navigator */}
        <aside className="flex w-[260px] shrink-0 flex-col border-r border-border/70 bg-muted/20">
          <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as 'library' | 'navigator')} className="flex flex-1 flex-col min-h-0">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-9">
              <TabsTrigger value="library" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                <LayoutGrid className="h-3.5 w-3.5" />
                Library
              </TabsTrigger>
              <TabsTrigger value="navigator" className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
                <ListTree className="h-3.5 w-3.5" />
                Navigator
              </TabsTrigger>
            </TabsList>
            <TabsContent value="library" className="mt-0 flex min-h-0 flex-1 flex-col p-2">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter"
                  value={libraryFilter}
                  onChange={(e) => setLibraryFilter(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-1 mb-1">
                Workflows
              </div>
              <ul className="space-y-0.5 overflow-y-auto max-h-40">
                {WORKFLOW_PRESETS.filter((p) => !libraryFilter || p.name.toLowerCase().includes(libraryFilter.toLowerCase())).map((preset) => (
                  <li key={preset.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWorkflowId(preset.id)
                        setCustomWorkflowJson(null)
                        setCustomWorkflowName('')
                        setWorkflowUploadError(null)
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                        selectedWorkflowId === preset.id ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <span className="truncate">{preset.name}</span>
                      <span className="text-[10px] text-muted-foreground">{preset.type}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-1 mb-1">
                Workflow templates (API)
              </div>
              <p className="px-1 text-[11px] text-muted-foreground mb-1">Select a template to use for generation.</p>
              <ul className="space-y-0.5 overflow-y-auto max-h-32">
                {workflows.map((wf) => (
                  <li key={wf.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedWorkflowTemplateId((id) => (id === wf.id ? null : wf.id))}
                      className={cn(
                        'flex w-full items-center justify-between gap-1 rounded-md px-2 py-1.5 text-left text-xs',
                        selectedWorkflowTemplateId === wf.id ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <span className="truncate">{wf.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{wf.type}</span>
                    </button>
                  </li>
                ))}
                {workflows.length === 0 && (
                  <li className="px-2 py-1.5 text-[11px] text-muted-foreground">No templates loaded</li>
                )}
              </ul>
              <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-1 mb-1">
                Upload your own
              </div>
              <input
                ref={workflowFileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleWorkflowFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => workflowFileInputRef.current?.click()}
              >
                Upload workflow (JSON)
              </Button>
              {customWorkflowName && (
                <div className="mt-1 flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1.5 text-[11px] text-primary">
                  <span className="truncate">{customWorkflowName}</span>
                  <button
                    type="button"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setCustomWorkflowJson(null)
                      setCustomWorkflowName('')
                      setSelectedWorkflowId(WORKFLOW_PRESETS[0]!.id)
                    }}
                    aria-label="Clear custom workflow"
                  >
                    ×
                  </button>
                </div>
              )}
              {workflowUploadError && (
                <p className="mt-1 px-1 text-[11px] text-destructive">{workflowUploadError}</p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 w-full justify-start text-xs text-muted-foreground hover:text-foreground"
                onClick={() => document.getElementById('studio-models-upload')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Upload your own model
              </Button>
              <div className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground px-1 mb-1">
                Presets
              </div>
              <p className="px-1 text-[11px] text-muted-foreground mb-1">Save and load prompt presets.</p>
              <div className="flex gap-1 mb-2">
                <Input
                  placeholder="Preset name"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  className="h-7 text-xs flex-1 min-w-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs shrink-0"
                  onClick={() => {
                    const name = presetNameInput.trim() || 'Untitled'
                    const values = controlsRef.current?.getValues()
                    if (!values) return
                    const next: PromptPreset = {
                      id: `preset-${Date.now()}`,
                      name,
                      prompt: values.prompt,
                      negativePrompt: values.negativePrompt,
                    }
                    const list = [...promptPresets, next]
                    setPromptPresets(list)
                    savePromptPresets(list)
                    setPresetNameInput('')
                  }}
                >
                  Save
                </Button>
              </div>
              <ul className="space-y-1 overflow-y-auto max-h-32">
                {promptPresets.map((preset) => (
                  <li key={preset.id} className="flex items-center gap-1 rounded-md bg-muted/50 px-2 py-1">
                    <span className="truncate text-[11px] flex-1 min-w-0" title={preset.name}>{preset.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-1.5 text-[10px] shrink-0"
                      onClick={() => controlsRef.current?.setValues({ prompt: preset.prompt, negativePrompt: preset.negativePrompt })}
                    >
                      Load
                    </Button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0 text-[10px]"
                      onClick={() => {
                        const list = promptPresets.filter((p) => p.id !== preset.id)
                        setPromptPresets(list)
                        savePromptPresets(list)
                      }}
                      aria-label="Delete preset"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </TabsContent>
            <TabsContent value="navigator" className="mt-0 flex min-h-0 flex-1 flex-col p-2">
              <div className="flex-1 overflow-y-auto">
                {FLOW_STEPS.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                      activeStep === step.id ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted text-foreground'
                    )}
                  >
                    <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{step.title}</span>
                  </button>
                ))}
                <div className="mt-2 border-t border-border pt-2">
                  <Link
                    href="/edit"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">Edit</span>
                    <span className="ml-1 rounded bg-primary/20 px-1 text-[10px] text-primary">New</span>
                  </Link>
                  <Link
                    href="/design"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                  >
                    <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">Design</span>
                  </Link>
                  <Link
                    href="/gallery"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                  >
                    <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">Show Output</span>
                  </Link>
                </div>
              </div>
              <div className="mt-2 border-t border-border pt-2">
                <p className="px-1 text-[10px] text-muted-foreground">Type to locate (⌘K)</p>
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* Center: Canvas */}
        <section className="flex min-w-0 flex-1 flex-col bg-muted/40">
          <div className="flex flex-1 items-center justify-center p-6">
            <div className="flex h-full w-full max-w-4xl flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/60">
              <p className="text-sm text-muted-foreground">Preview</p>
              <p className="mt-1 text-xs text-muted-foreground">How the current scene will look in your reel or clip.</p>
              <div className="mt-4 h-48 w-64 rounded-md border border-border bg-muted/80 flex items-center justify-center text-xs text-muted-foreground">
                Preview frame
              </div>
            </div>
          </div>
        </section>

        {/* Right panel: Properties */}
        <aside className="flex w-[320px] shrink-0 flex-col border-l border-border/70 bg-muted/20">
          <div className="border-b border-border px-3 py-2">
            <h2 className="text-sm font-semibold text-foreground">Properties</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {FLOW_STEPS.find((s) => s.id === activeStep)?.title ?? 'Select a step'}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {activeStep === 'generation' ? (
              <>
                <div className="mb-3">
                  <Label className="text-[11px] text-muted-foreground">Creator</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground"
                    value={selectedInfluencerId}
                    onChange={(e) => setSelectedInfluencerId(e.target.value)}
                  >
                    {!influencers.length && <option value="">No creators in workspace</option>}
                    {influencers.map((inf) => (
                      <option key={inf.id} value={inf.id}>
                        {inf.display_name || inf.name || inf.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <Label className="text-[11px] text-muted-foreground">Type</Label>
                  <p className="text-xs font-medium">Generation (Comfy)</p>
                </div>
                {(() => {
                  const mode = IMAGE_WORKFLOW_IDS.includes(selectedWorkflowId) ? 'IMAGE' : 'VIDEO'
                  const templateForCost = workflows.find((w) => w.type === mode)
                  const credits = templateForCost?.base_cost_credits
                  return (
                    credits != null && Number.isFinite(credits) && (
                      <p className="mb-3 text-[11px] text-muted-foreground">
                        Cost: ~{Number(credits)} credits per run
                      </p>
                    )
                  )
                })()}
                <StudioGenerationControls
                  ref={controlsRef}
                  selectedWorkflowId={selectedWorkflowId}
                  customWorkflowJson={customWorkflowJson}
                  presetModelId={WORKFLOW_PRESETS.find((p) => p.id === selectedWorkflowId)?.modelId}
                  batchLimit={batchLimit}
                />
                <div id="studio-models-upload" className="mt-4 scroll-mt-4">
                  <ModelUploadPanel />
                </div>
              </>
            ) : (
              <PropertiesStepContent step={activeStep} />
            )}
          </div>
        </aside>
      </div>

      {/* Bottom panel: Log / Queue */}
      <div className="shrink-0 border-t border-border bg-muted/20">
        <button
          type="button"
          onClick={() => setBottomOpen(!bottomOpen)}
          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/50"
        >
          <span className="flex items-center gap-2">
            {bottomOpen ? <PanelBottomOpen className="h-3.5 w-3.5" /> : <PanelBottomClose className="h-3.5 w-3.5" />}
            {bottomOpen ? 'Generation log' : 'Show output'}
          </span>
        </button>
        {bottomOpen && (
          <Tabs value={bottomTab} onValueChange={(v) => setBottomTab(v as 'log' | 'queue')} className="border-t border-border">
            <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-8">
              <TabsTrigger value="log" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs">
                1 Generation log
              </TabsTrigger>
              <TabsTrigger value="queue" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs">
                2 Queue
              </TabsTrigger>
            </TabsList>
            <TabsContent value="log" className="m-0 p-3 h-24 overflow-y-auto text-[11px] text-muted-foreground">
              {genError && <p className="text-destructive mb-1">{genError}</p>}
              {logLines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </TabsContent>
            <TabsContent value="queue" className="m-0 p-3 h-24 overflow-y-auto text-[11px] text-muted-foreground">
              <p>No jobs in queue.</p>
            </TabsContent>
          </Tabs>
        )}
      </div>
      </div>
    </div>
  )
}

function PropertiesStepContent({ step }: { step: FlowStep }) {
  if (step === 'look') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-[11px] text-muted-foreground">Influencer name</Label>
          <Input className="mt-1 h-8 text-xs" placeholder="Luna.ai" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Short bio</Label>
          <textarea
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            rows={3}
            placeholder="Night-owl fashion creator..."
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Style tags</Label>
          <Input className="mt-1 h-8 text-xs" placeholder="futuristic, cozy, neon" />
        </div>
      </div>
    )
  }
  if (step === 'personality') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-[11px] text-muted-foreground">Voice & tone</Label>
          <textarea
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            rows={3}
            placeholder="Playful but grounded..."
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Do</Label>
          <textarea className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" rows={2} placeholder="Encourage viewers..." />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Don&apos;t</Label>
          <textarea className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" rows={2} placeholder="Break character..." />
        </div>
      </div>
    )
  }
  if (step === 'scenes') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-[11px] text-muted-foreground">Scene outline</Label>
          <textarea
            className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            rows={3}
            placeholder="1) Hook shot, 2) Main tip..."
          />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Target emotion</Label>
          <select className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs">
            <option>Confident</option>
            <option>Cozy</option>
            <option>High energy</option>
            <option>Intimate</option>
          </select>
        </div>
      </div>
    )
  }
  if (step === 'output') {
    return (
      <div className="space-y-3">
        <div>
          <Label className="text-[11px] text-muted-foreground">Aspect ratio</Label>
          <select className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs">
            <option>9:16 (vertical)</option>
            <option>1:1 (square)</option>
            <option>16:9 (horizontal)</option>
          </select>
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Platforms</Label>
          <Input className="mt-1 h-8 text-xs" placeholder="TikTok, Instagram Reels" />
        </div>
        <div>
          <Label className="text-[11px] text-muted-foreground">Caption prompt</Label>
          <textarea className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" rows={2} placeholder="Short caption + hashtags..." />
        </div>
      </div>
    )
  }
  return null
}
