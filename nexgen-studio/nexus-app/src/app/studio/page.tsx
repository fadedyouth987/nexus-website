'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ModelUploadPanel } from './ModelUploadPanel'
import { StudioGenerationControls, type StudioGenerationControlsRef } from './StudioGenerationControls'
import { LayoutGrid, ListTree, Search, Eye, Play, PanelBottomClose, PanelBottomOpen, Pencil, ImageIcon, Loader2, Megaphone, Copy, Hash, Video } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/core/utils'
import apiFetch from '@/lib/core/api'
import { useWorkspace } from '@/context/WorkspaceContext'
import { generationOutputLimitByPlan, normalizePlan } from '@/lib/billing/planLimits'

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
  const [outputFormat, setOutputFormat] = useState('reel')
  const [nsfwEnabled, setNsfwEnabled] = useState(false)
  const [generatedAssets, setGeneratedAssets] = useState<Array<{ id: string; kind: string; url?: string }>>([])
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [campaignGenerating, setCampaignGenerating] = useState(false)
  const [campaignResult, setCampaignResult] = useState<{
    caption: string
    hashtags: string[]
    platform: string
    outputs: Array<{ signedUrl?: string; kind: string }>
  } | null>(null)
  const [campaignPlatform, setCampaignPlatform] = useState('instagram')
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

  const loadGeneratedAssets = useCallback(async (genJobId: string) => {
    try {
      const res = await apiFetch(`/generate/${genJobId}`)
      if (!res.ok) return
      const payload = (await res.json()) as { assets?: Array<{ id: string; kind: string }> }
      const assets = payload.assets ?? []
      const withUrls = await Promise.all(
        assets.map(async (a) => {
          try {
            const signedRes = await apiFetch(`/assets/${a.id}/signed-url`)
            if (!signedRes.ok) return { ...a, url: undefined }
            const signed = (await signedRes.json()) as { signedUrl?: string }
            return { ...a, url: signed.signedUrl }
          } catch {
            return { ...a, url: undefined }
          }
        })
      )
      setGeneratedAssets(withUrls)
    } catch { /* ignore */ }
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
    setPreviewDataUrl(null)
    setGeneratedAssets([])
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
            format: outputFormat,
            content_rating: nsfwEnabled ? 'nsfw' : 'sfw',
          },
          ...(customWorkflowJson && selectedWorkflowId === 'custom' ? { customWorkflow: customWorkflowJson } : {}),
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
          if (status === 'READY') {
            setJobProgress({ status: 'idle' })
            closeProgressStream()
            setGenerating(false)
            void loadGeneratedAssets(id)
          }
          if (status === 'FAILED') {
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
      eventSource.addEventListener('preview', (e: MessageEvent<string>) => {
        try {
          const data = JSON.parse(e.data) as { image?: string; data_url?: string }
          const url = data.data_url || (data.image ? `data:image/png;base64,${data.image}` : null)
          if (url) setPreviewDataUrl(url)
        } catch { /* ignore */ }
      })
      eventSource.addEventListener('status', (e: MessageEvent<string>) => {
        try {
          const data = JSON.parse(e.data) as { status?: string; message?: string }
          setLogLines((prev) => [...prev, `Status: ${data?.status ?? 'unknown'}${data?.message ? ` – ${data.message}` : ''}`])
          if (data?.status === 'FAILED' && data?.message) {
            setGenError(data.message)
          }
          if (data?.status === 'READY') {
            setJobProgress({ status: 'idle' })
            closeProgressStream()
            setGenerating(false)
            void loadGeneratedAssets(id)
          }
          if (data?.status === 'FAILED') {
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
    outputFormat,
    nsfwEnabled,
    customWorkflowJson,
  ])

  const handleCampaignGenerate = useCallback(async () => {
    const values = controlsRef.current?.getValues()
    const prompt = values?.prompt?.trim() ?? ''
    if (!prompt) {
      setGenError('Enter a positive prompt.')
      return
    }
    const template = selectedWorkflowTemplateId
      ? workflows.find((w) => w.id === selectedWorkflowTemplateId)
      : workflows.find((w) => w.type === 'IMAGE')
    if (!template) {
      setGenError('No IMAGE workflow template available for campaign generation.')
      return
    }
    if (!selectedInfluencerId) {
      setGenError('Select an influencer first.')
      return
    }
    setCampaignGenerating(true)
    setCampaignResult(null)
    setGenError(null)
    try {
      const res = await fetch('/api/generate/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId: selectedInfluencerId,
          workflowTemplateId: template.id,
          platform: campaignPlatform,
          content_rating: nsfwEnabled ? 'nsfw' : 'sfw',
          variables: {
            prompt,
            negative_prompt: values?.negativePrompt?.trim() ?? '',
            batch_size: 1,
          },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { detail?: string }).detail || 'Campaign generation failed')
      }
      const data = await res.json()
      setCampaignResult({
        caption: data.caption ?? '',
        hashtags: data.hashtags ?? [],
        platform: data.platform ?? campaignPlatform,
        outputs: data.outputs ?? [],
      })
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Campaign generation failed')
    } finally {
      setCampaignGenerating(false)
    }
  }, [selectedInfluencerId, selectedWorkflowTemplateId, workflows, campaignPlatform, nsfwEnabled])

  useEffect(() => () => closeProgressStream(), [closeProgressStream])

  return (
    <div className="-mx-[var(--content-padding)] -mt-6 flex flex-col sm:-mt-8" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Compact studio header bar */}
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/70 bg-background/80 px-4 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold tracking-tight text-foreground">Studio</span>
          </div>
          <div className="hidden h-5 w-px bg-border/70 sm:block" />
          <select
            className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground"
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value)}
          >
            <option value="reel">TikTok Reel</option>
            <option value="story">Instagram Story</option>
            <option value="short">YouTube Short</option>
            <option value="custom">Custom</option>
          </select>
          <label className="hidden items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer sm:flex">
            <Switch checked={nsfwEnabled} onCheckedChange={setNsfwEnabled} />
            NSFW
          </label>
          <div className="hidden h-5 w-px bg-border/70 sm:block" />
          <span className="hidden rounded-full border border-border/60 bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
            {planTier} · {batchLimit} max
          </span>
          {jobProgress.status !== 'idle' && (
            <span className="text-[11px] font-medium text-primary">
              {jobProgress.status === 'queued' && 'Queued…'}
              {jobProgress.status === 'running' && (
                jobProgress.percent != null ? `${jobProgress.percent}%` : (jobProgress.message || 'Running…')
              )}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="hidden gap-1.5 text-xs sm:flex" asChild>
            <Link href="/gallery">Gallery</Link>
          </Button>
          <Button size="sm" className="gap-2 px-4" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Generate
          </Button>
        </div>
      </div>

      {/* Main three-column area - fills remaining viewport */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel: Library + Navigator */}
        <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border/50 bg-muted/10 lg:flex">
          <Tabs value={leftTab} onValueChange={(v) => setLeftTab(v as 'library' | 'navigator')} className="flex flex-1 flex-col min-h-0">
            <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent p-0 h-8">
              <TabsTrigger value="library" className="gap-1.5 rounded-none border-b-2 border-transparent text-[11px] data-[state=active]:border-primary data-[state=active]:bg-transparent">
                <LayoutGrid className="h-3 w-3" />
                Library
              </TabsTrigger>
              <TabsTrigger value="navigator" className="gap-1.5 rounded-none border-b-2 border-transparent text-[11px] data-[state=active]:border-primary data-[state=active]:bg-transparent">
                <ListTree className="h-3 w-3" />
                Navigator
              </TabsTrigger>
            </TabsList>
            <TabsContent value="library" className="mt-0 flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter workflows…"
                  value={libraryFilter}
                  onChange={(e) => setLibraryFilter(e.target.value)}
                  className="h-7 pl-7 text-[11px]"
                />
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-1">
                Workflows
              </div>
              <ul className="space-y-0.5">
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
                        'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px]',
                        selectedWorkflowId === preset.id ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted/60 text-foreground'
                      )}
                    >
                      <span className="truncate">{preset.name}</span>
                      <span className="text-[9px] text-muted-foreground">{preset.type}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-1">
                Templates (API)
              </div>
              <ul className="space-y-0.5">
                {workflows.map((wf) => (
                  <li key={wf.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedWorkflowTemplateId((id) => (id === wf.id ? null : wf.id))}
                      className={cn(
                        'flex w-full items-center justify-between gap-1 rounded-md px-2 py-1 text-left text-[11px]',
                        selectedWorkflowTemplateId === wf.id ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted/60 text-foreground'
                      )}
                    >
                      <span className="truncate">{wf.name}</span>
                      <span className="text-[9px] text-muted-foreground shrink-0">{wf.type}</span>
                    </button>
                  </li>
                ))}
                {workflows.length === 0 && (
                  <li className="px-2 py-1 text-[10px] text-muted-foreground">No templates loaded</li>
                )}
              </ul>
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-1">
                Custom
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
                className="w-full justify-start text-[11px] h-7"
                onClick={() => workflowFileInputRef.current?.click()}
              >
                Upload workflow (JSON)
              </Button>
              {customWorkflowName && (
                <div className="mt-1 flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] text-primary">
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
                <p className="mt-1 px-1 text-[10px] text-destructive">{workflowUploadError}</p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1 w-full justify-start text-[11px] h-7 text-muted-foreground hover:text-foreground"
                onClick={() => document.getElementById('studio-models-upload')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Upload model
              </Button>
              <div className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-1 mb-1">
                Presets
              </div>
              <div className="flex gap-1 mb-1">
                <Input
                  placeholder="Name"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  className="h-6 text-[11px] flex-1 min-w-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] shrink-0 px-2"
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
              <ul className="space-y-0.5">
                {promptPresets.map((preset) => (
                  <li key={preset.id} className="flex items-center gap-1 rounded-md bg-muted/40 px-2 py-0.5">
                    <span className="truncate text-[10px] flex-1 min-w-0" title={preset.name}>{preset.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 px-1 text-[9px] shrink-0"
                      onClick={() => controlsRef.current?.setValues({ prompt: preset.prompt, negativePrompt: preset.negativePrompt })}
                    >
                      Load
                    </Button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0 text-[9px]"
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
              <div className="flex-1 overflow-y-auto space-y-0.5">
                {FLOW_STEPS.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStep(step.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px]',
                      activeStep === step.id ? 'bg-primary/15 text-primary font-medium' : 'hover:bg-muted/60 text-foreground'
                    )}
                  >
                    <Eye className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">{step.title}</span>
                  </button>
                ))}
                <div className="mt-2 border-t border-border/50 pt-2 space-y-0.5">
                  <Link href="/edit" className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-foreground hover:bg-muted/60">
                    <Pencil className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">Edit</span>
                  </Link>
                  <Link href="/design" className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-foreground hover:bg-muted/60">
                    <LayoutGrid className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">Design</span>
                  </Link>
                  <Link href="/gallery" className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] text-foreground hover:bg-muted/60">
                    <ImageIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="truncate">Gallery</span>
                  </Link>
                </div>
              </div>
              <div className="mt-1 border-t border-border/50 pt-1">
                <p className="px-1 text-[9px] text-muted-foreground/60">⌘K to search</p>
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* Center: Canvas */}
        <section className="flex min-w-0 flex-1 flex-col bg-black/[0.03] dark:bg-black/20">
          <div className="flex flex-1 items-center justify-center overflow-y-auto p-4">
            {generatedAssets.length > 0 ? (
              <div className="w-full max-w-5xl space-y-4">
                <div className={cn('grid gap-3', generatedAssets.length === 1 ? 'grid-cols-1 max-w-2xl mx-auto' : 'grid-cols-1 sm:grid-cols-2')}>
                  {generatedAssets.map((asset) => (
                    <div key={asset.id} className="group rounded-lg border border-border/50 bg-card/80 overflow-hidden shadow-sm backdrop-blur-sm">
                      {asset.url ? (
                        asset.kind === 'VIDEO' ? (
                          <video src={asset.url} controls className="w-full" />
                        ) : (
                          <img src={asset.url} alt="Generated" className="w-full" />
                        )
                      ) : (
                        <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Loading...</div>
                      )}
                      <div className="flex gap-1.5 p-2 border-t border-border/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button size="sm" variant="ghost" className="text-[11px] flex-1 h-7" asChild>
                          <Link href={`/edit?assetId=${asset.id}`}>Edit</Link>
                        </Button>
                        <Button size="sm" variant="ghost" className="text-[11px] flex-1 h-7" asChild>
                          <Link href="/gallery">Gallery</Link>
                        </Button>
                        <Button size="sm" variant="ghost" className="text-[11px] flex-1 h-7" asChild>
                          <Link href="/planner">Schedule</Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : generating ? (
              <div className="flex flex-col items-center gap-4 w-full max-w-lg">
                {previewDataUrl ? (
                  <>
                    <img src={previewDataUrl} alt="Generation preview" className="w-full rounded-lg border border-white/10 shadow-2xl" />
                    <p className="text-[11px] text-muted-foreground">Live preview</p>
                  </>
                ) : (
                  <Loader2 className="h-10 w-10 animate-spin text-primary/70" />
                )}
                <p className="text-xs text-muted-foreground">
                  {jobProgress.message || (jobProgress.percent != null ? `Generating ${jobProgress.percent}%…` : 'Generating…')}
                </p>
                {jobProgress.percent != null && (
                  <div className="w-48 h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${jobProgress.percent}%` }} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/40">
                  <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground/70">No output yet</p>
                  <p className="mt-1 max-w-xs text-[11px] text-muted-foreground/50">Configure a prompt in the Properties panel and click Generate.</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Right panel: Properties */}
        <aside className="flex w-[300px] shrink-0 flex-col border-l border-border/50 bg-muted/10">
          <div className="border-b border-border/50 px-3 py-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">Properties</h2>
            <p className="text-[10px] text-muted-foreground">
              {FLOW_STEPS.find((s) => s.id === activeStep)?.title ?? 'Select a step'}
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {activeStep === 'generation' ? (
              <>
                <div className="mb-3">
                  <Label className="text-[10px] text-muted-foreground">Creator</Label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground"
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
                {(() => {
                  const mode = IMAGE_WORKFLOW_IDS.includes(selectedWorkflowId) ? 'IMAGE' : 'VIDEO'
                  const templateForCost = workflows.find((w) => w.type === mode)
                  const credits = templateForCost?.base_cost_credits
                  return (
                    credits != null && Number.isFinite(credits) && (
                      <p className="mb-3 text-[10px] text-muted-foreground">
                        ~{Number(credits)} credits per run
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

                <div className="mt-4 border-t border-border/50 pt-4">
                  <h3 className="text-[11px] font-semibold text-foreground flex items-center gap-1.5 mb-2">
                    <Megaphone className="h-3 w-3" /> Campaign Post
                  </h3>
                  <div className="mb-2">
                    <Label className="text-[10px] text-muted-foreground">Platform</Label>
                    <select
                      className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground"
                      value={campaignPlatform}
                      onChange={(e) => setCampaignPlatform(e.target.value)}
                    >
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="twitter">X (Twitter)</option>
                      <option value="facebook">Facebook</option>
                      <option value="youtube">YouTube</option>
                      <option value="linkedin">LinkedIn</option>
                      <option value="reddit">Reddit</option>
                      <option value="onlyfans">OnlyFans</option>
                      <option value="fansly">Fansly</option>
                    </select>
                  </div>
                  <Button
                    size="sm"
                    className="w-full gap-2 h-7 text-[11px]"
                    variant="secondary"
                    onClick={handleCampaignGenerate}
                    disabled={campaignGenerating || generating}
                  >
                    {campaignGenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Megaphone className="h-3 w-3" />
                    )}
                    {campaignGenerating ? 'Generating…' : 'Campaign Post'}
                  </Button>

                  {campaignResult && (
                    <div className="mt-3 space-y-2 rounded-md border border-border/50 bg-card p-2">
                      {campaignResult.outputs.map((o, i) =>
                        o.signedUrl ? (
                          <img key={i} src={o.signedUrl} alt="Campaign output" className="w-full rounded" />
                        ) : null
                      )}
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-[11px] text-foreground whitespace-pre-wrap flex-1">{campaignResult.caption}</p>
                          <button
                            type="button"
                            className="shrink-0 p-0.5 hover:bg-muted rounded"
                            onClick={() => navigator.clipboard.writeText(campaignResult.caption)}
                            title="Copy caption"
                          >
                            <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                          </button>
                        </div>
                        {campaignResult.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {campaignResult.hashtags.map((tag, i) => (
                              <span key={i} className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">
                                <Hash className="h-2 w-2" />{tag.replace(/^#/, '')}
                              </span>
                            ))}
                          </div>
                        )}
                        <button
                          type="button"
                          className="text-[9px] text-muted-foreground hover:text-foreground underline"
                          onClick={() => {
                            const text = `${campaignResult.caption}\n\n${campaignResult.hashtags.join(' ')}`
                            navigator.clipboard.writeText(text)
                          }}
                        >
                          Copy all
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <PropertiesStepContent step={activeStep} />
            )}
          </div>
        </aside>
      </div>

      {/* Bottom panel: Log / Queue */}
      <div className="shrink-0 border-t border-border/50 bg-muted/10">
        <button
          type="button"
          onClick={() => setBottomOpen(!bottomOpen)}
          className="flex w-full items-center justify-between px-4 py-1 text-left text-[10px] text-muted-foreground hover:bg-muted/30"
        >
          <span className="flex items-center gap-1.5">
            {bottomOpen ? <PanelBottomOpen className="h-3 w-3" /> : <PanelBottomClose className="h-3 w-3" />}
            {bottomOpen ? 'Log' : 'Show log'}
          </span>
          {genError && !bottomOpen && <span className="text-[9px] text-destructive">Error</span>}
        </button>
        {bottomOpen && (
          <Tabs value={bottomTab} onValueChange={(v) => setBottomTab(v as 'log' | 'queue')} className="border-t border-border/50">
            <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent p-0 h-7">
              <TabsTrigger value="log" className="rounded-none border-b-2 border-transparent text-[10px] data-[state=active]:border-primary">
                Log
              </TabsTrigger>
              <TabsTrigger value="queue" className="rounded-none border-b-2 border-transparent text-[10px] data-[state=active]:border-primary">
                Queue
              </TabsTrigger>
            </TabsList>
            <TabsContent value="log" className="m-0 px-4 py-2 h-28 overflow-y-auto font-mono text-[10px] text-muted-foreground">
              {genError && <p className="text-destructive mb-1">{genError}</p>}
              {logLines.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </TabsContent>
            <TabsContent value="queue" className="m-0 px-4 py-2 h-28 overflow-y-auto font-mono text-[10px] text-muted-foreground">
              <p>No jobs in queue.</p>
            </TabsContent>
          </Tabs>
        )}
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
