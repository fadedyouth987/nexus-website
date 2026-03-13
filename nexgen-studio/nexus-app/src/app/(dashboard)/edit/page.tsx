'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppHero } from '@/components/layout/AppHero'
import { useWorkspace } from '@/context/WorkspaceContext'
import apiFetch from '@/lib/core/api'
import {
  LayoutGrid,
  ListTree,
  Search,
  Eye,
  PanelBottomClose,
  PanelBottomOpen,
  Smile,
  Image,
  Wrench,
  Sparkles,
  Film,
  Layers,
  Upload,
  Undo2,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/core/utils'

type EditStep =
  | 'face'
  | 'background'
  | 'fix'
  | 'enhance'
  | 'video'
  | 'canvas'

const EDIT_STEPS: { id: EditStep; title: string; icon: React.ElementType }[] = [
  { id: 'face', title: 'Face', icon: Smile },
  { id: 'background', title: 'Background', icon: Image },
  { id: 'fix', title: 'Image Fix', icon: Wrench },
  { id: 'enhance', title: 'Enhancement', icon: Sparkles },
  { id: 'video', title: 'Video', icon: Film },
  { id: 'canvas', title: 'Canvas', icon: Layers },
]

const FACE_TOOLS = [
  { id: 'face-swap', label: 'Face Swap', desc: 'Upload or choose from influencer identity' },
  { id: 'face-restore', label: 'Face Correction / Restore', desc: 'Fix artifacts and restore clarity' },
  { id: 'expression', label: 'Expression Change', desc: 'Adjust expression and mood' },
  { id: 'age-makeup', label: 'Age / Makeup / Style', desc: 'Fine-tune age, makeup, and style' },
]

const BACKGROUND_TOOLS = [
  { id: 'bg-remove', label: 'Background Remover', desc: 'Remove background automatically' },
  { id: 'bg-replace', label: 'Background Replace', desc: 'Preset scenes or custom upload' },
  { id: 'blur-dof', label: 'Blur / Depth-of-field', desc: 'Add blur and depth effects' },
  { id: 'greenscreen', label: 'Green-screen extraction', desc: 'Extract from green screen' },
]

const IMAGE_FIX_TOOLS = [
  { id: 'hand-fix', label: 'Hand Fixer', desc: 'Fix hand and finger artifacts' },
  { id: 'eye-fix', label: 'Eye Fixer', desc: 'Correct eyes and gaze' },
  { id: 'body-proportion', label: 'Body Proportion Fix', desc: 'Adjust proportions' },
  { id: 'lighting', label: 'Lighting Correction', desc: 'Fix lighting and shadows' },
  { id: 'color-grade', label: 'Color Grading', desc: 'Adjust color and tone' },
]

const ENHANCEMENT_TOOLS = [
  { id: 'upscale', label: 'Upscaler', desc: '4x, 8x upscaling' },
  { id: 'sharpen', label: 'Sharpen / Detail Boost', desc: 'Enhance detail' },
  { id: 'denoise', label: 'Noise Reduction', desc: 'Reduce noise and grain' },
  { id: 'aspect', label: 'Aspect Ratio Converter', desc: '9:16, 1:1, 4:5, 16:9' },
]

const VIDEO_TOOLS = [
  { id: 'video-face-swap', label: 'Face Swap in video', desc: 'Consistent face across frames' },
  { id: 'video-bg', label: 'Background Replace', desc: 'Replace video background' },
  { id: 'stabilize', label: 'Motion Stabilization', desc: 'Stabilize shaky footage' },
  { id: 'video-grade', label: 'Color Grading', desc: 'Grade video look' },
  { id: 'subtitles', label: 'Subtitle Generator', desc: 'Add captions and subtitles' },
  { id: 'audio-replace', label: 'Audio Replace', desc: 'Replace or add audio' },
]

const CANVAS_FEATURES = [
  { id: 'layers', label: 'Layers', desc: 'Layer-based editing' },
  { id: 'stickers', label: 'Stickers', desc: 'Add stickers and overlays' },
  { id: 'text', label: 'Text', desc: 'Add text and captions' },
  { id: 'filters', label: 'Filters', desc: 'Apply filters and LUTs' },
  { id: 'crop', label: 'Cropping', desc: 'Crop and reframe' },
  { id: 'masking', label: 'Masking', desc: 'Mask and blend' },
]

const TOOLS_BY_STEP: Record<EditStep, Array<{ id: string; label: string; desc: string }>> = {
  face: FACE_TOOLS,
  background: BACKGROUND_TOOLS,
  fix: IMAGE_FIX_TOOLS,
  enhance: ENHANCEMENT_TOOLS,
  video: VIDEO_TOOLS,
  canvas: CANVAS_FEATURES,
}

type EditOperation = {
  id: string
  toolId: string
  toolLabel: string
  step: EditStep
  status: 'queued' | 'applied' | 'failed'
  createdAt: number
}

type BillingSnapshot = {
  plan: string
  planStatus: string
  tokenBalance: number
}

type GalleryAsset = {
  id: string
  type?: string
  thumbnail_path?: string
  storage_path?: string
}

const RECIPE_STORAGE_KEY = 'nexus_edit_recipes_v1'

const EDIT_TIER_TRACKS: Array<{
  plan: string
  title: string
  audience: string
  batchLimit: number
  summary: string
}> = [
  {
    plan: 'STARTER',
    title: 'Tier 1',
    audience: 'Solo influencer',
    batchLimit: 2,
    summary: 'Daily single-creator edits, fast turnaround, focused output quality.',
  },
  {
    plan: 'PRO',
    title: 'Tier 2',
    audience: 'Growth operator',
    batchLimit: 8,
    summary: 'Batch-ready daily workflow for multiple content variants and channels.',
  },
  {
    plan: 'ENTERPRISE',
    title: 'Tier 3',
    audience: 'Scaling agency',
    batchLimit: 24,
    summary: 'High-throughput editing operations with large batch dispatch.',
  },
]

function normalizePlan(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : 'STARTER'
}

function normalizeTierTrack(value: unknown): string {
  const plan = normalizePlan(value)
  return plan === 'VAULT' ? 'PRO' : plan
}

function editBatchLimitByPlan(value: unknown): number {
  const plan = normalizePlan(value)
  if (plan === 'ENTERPRISE') return 24
  if (plan === 'PRO' || plan === 'VAULT') return 8
  return 2
}

const TOOL_PRESETS: Record<string, Array<{ id: string; label: string; params: Record<string, unknown> }>> = {
  upscale: [
    { id: 'upscale-2x', label: '2x fast', params: { factor: 2, detail: 'balanced' } },
    { id: 'upscale-4x', label: '4x quality', params: { factor: 4, detail: 'high' } },
    { id: 'upscale-8x', label: '8x max', params: { factor: 8, detail: 'high' } },
  ],
  denoise: [
    { id: 'denoise-light', label: 'Light denoise', params: { strength: 0.2 } },
    { id: 'denoise-medium', label: 'Medium denoise', params: { strength: 0.45 } },
    { id: 'denoise-heavy', label: 'Heavy denoise', params: { strength: 0.7 } },
  ],
  'bg-replace': [
    { id: 'bg-replace-studio', label: 'Studio backdrop', params: { preset: 'studio' } },
    { id: 'bg-replace-city', label: 'City night', params: { preset: 'city-night' } },
    { id: 'bg-replace-minimal', label: 'Minimal', params: { preset: 'minimal' } },
  ],
  'face-restore': [
    { id: 'face-restore-soft', label: 'Soft restore', params: { sharpness: 0.25 } },
    { id: 'face-restore-standard', label: 'Standard restore', params: { sharpness: 0.45 } },
    { id: 'face-restore-strong', label: 'Strong restore', params: { sharpness: 0.65 } },
  ],
}

export default function EditPage() {
  const { currentWorkspace } = useWorkspace()
  const [activeStep, setActiveStep] = useState<EditStep>('face')
  const [leftTab, setLeftTab] = useState<'library' | 'navigator'>('navigator')
  const [bottomOpen, setBottomOpen] = useState(false)
  const [bottomTab, setBottomTab] = useState<'history' | 'layers'>('history')
  const [libraryFilter, setLibraryFilter] = useState('')
  const [hasAsset, setHasAsset] = useState(false)
  const [assetName, setAssetName] = useState<string | null>(null)
  const [assetType, setAssetType] = useState<'image' | 'video'>('image')
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)
  const [assetPreviewUrl, setAssetPreviewUrl] = useState<string | null>(null)
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState<string | null>(null)
  const [galleryAssets, setGalleryAssets] = useState<GalleryAsset[]>([])
  const [batchAssetIds, setBatchAssetIds] = useState<string[]>([])
  const [batchMode, setBatchMode] = useState(false)
  const [toolFilter, setToolFilter] = useState('')
  const [operations, setOperations] = useState<EditOperation[]>([])
  const [editMessage, setEditMessage] = useState<string | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState<Record<string, string>>({})
  const [recipes, setRecipes] = useState<Array<{ id: string; name: string; steps: string[] }>>([])
  const [recipeName, setRecipeName] = useState('')
  const [selectedRecipeId, setSelectedRecipeId] = useState('')
  const [billing, setBilling] = useState<BillingSnapshot>({
    plan: 'STARTER',
    planStatus: 'ACTIVE',
    tokenBalance: 0,
  })
  const [batchLimit, setBatchLimit] = useState(2)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setHasAsset(true)
      setAssetName(file.name)
      setAssetType(file.type.startsWith('video/') ? 'video' : 'image')
      setActiveAssetId(`upload:${file.name}:${Date.now()}`)
      setAssetPreviewUrl(null)
      if (uploadPreviewUrl) URL.revokeObjectURL(uploadPreviewUrl)
      setUploadPreviewUrl(URL.createObjectURL(file))
      setEditMessage('Asset loaded. Choose tools and apply edits.')
    }
    e.target.value = ''
  }

  useEffect(() => {
    let cancelled = false
    async function loadAssets() {
      if (!currentWorkspace?.id) return
      try {
        const res = await apiFetch(`/workspaces/${currentWorkspace.id}/assets`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as GalleryAsset[] | { items?: GalleryAsset[] }
        const list = Array.isArray(data) ? data : (data?.items ?? [])
        if (!cancelled) {
          setGalleryAssets(list)
          if (!activeAssetId && list[0]?.id) {
            setActiveAssetId(String(list[0].id))
            setHasAsset(true)
            setAssetName('Gallery asset')
            setAssetType(String(list[0].type || '').toLowerCase() === 'video' ? 'video' : 'image')
          }
        }
      } catch {
        if (!cancelled) setGalleryAssets([])
      }
    }
    loadAssets()
    return () => {
      cancelled = true
    }
  }, [currentWorkspace?.id, activeAssetId])

  useEffect(() => {
    if (!activeAssetId || activeAssetId.startsWith('upload:')) {
      setAssetPreviewUrl(null)
      return
    }
    let cancelled = false
    async function fetchUrl() {
      try {
        const res = await apiFetch(`/assets/${activeAssetId}/signed-url`)
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { signedUrl?: string }
        if (!cancelled && data.signedUrl) setAssetPreviewUrl(data.signedUrl)
      } catch {
        if (!cancelled) setAssetPreviewUrl(null)
      }
    }
    void fetchUrl()
    return () => { cancelled = true }
  }, [activeAssetId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(RECIPE_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as Array<{ id: string; name: string; steps: string[] }>
      if (Array.isArray(parsed)) setRecipes(parsed)
    } catch {
      // ignore invalid local storage data
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadBilling() {
      try {
        const response = await apiFetch('/billing/me')
        if (!response.ok || cancelled) return
        const payload = (await response.json()) as {
          plan?: string
          planStatus?: string
          tokenBalance?: number
          balance?: number
        }
        const normalized = normalizePlan(payload.plan)
        if (!cancelled) {
          setBilling({
            plan: normalized,
            planStatus: typeof payload.planStatus === 'string' ? payload.planStatus : 'ACTIVE',
            tokenBalance: Number(payload.tokenBalance ?? payload.balance ?? 0),
          })
          setBatchLimit(editBatchLimitByPlan(normalized))
        }
      } catch {
        if (!cancelled) {
          setBatchLimit(2)
        }
      }
    }

    void loadBilling()

    return () => {
      cancelled = true
    }
  }, [])

  const stepTitle = EDIT_STEPS.find((s) => s.id === activeStep)?.title ?? 'Unknown'
  const queuedCount = operations.filter((o) => o.status === 'queued').length
  const appliedCount = operations.filter((o) => o.status === 'applied').length
  const activeTier = EDIT_TIER_TRACKS.find((tier) => tier.plan === normalizeTierTrack(billing.plan)) ?? EDIT_TIER_TRACKS[0]

  function resetEditor() {
    setHasAsset(false)
    setAssetName(null)
    setActiveAssetId(null)
    setOperations([])
    setEditMessage(null)
    setToolFilter('')
    setBatchAssetIds([])
    setBatchMode(false)
  }

  function undoLastOperation() {
    setOperations((prev) => prev.slice(0, -1))
    setEditMessage('Last operation removed from history.')
  }

  function getPresetParams(toolId: string): Record<string, unknown> {
    const selected = selectedPresetId[toolId]
    const presets = TOOL_PRESETS[toolId] ?? []
    const hit = presets.find((preset) => preset.id === selected)
    return hit?.params ?? {}
  }

  function toggleBatchAsset(assetId: string) {
    setBatchAssetIds((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    )
  }

  function saveRecipe() {
    const trimmed = recipeName.trim()
    if (!trimmed) {
      setEditMessage('Enter a recipe name first.')
      return
    }
    const stepIds = operations.map((op) => op.toolId)
    if (stepIds.length === 0) {
      setEditMessage('Add at least one operation before saving.')
      return
    }
    const next = [
      { id: `${Date.now()}`, name: trimmed.slice(0, 80), steps: stepIds },
      ...recipes,
    ].slice(0, 20)
    setRecipes(next)
    setRecipeName('')
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RECIPE_STORAGE_KEY, JSON.stringify(next))
    }
    setEditMessage(`Saved recipe "${trimmed}".`)
  }

  function loadRecipe(recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId)
    if (!recipe) return
    const now = Date.now()
    const loadedOps = recipe.steps.map((toolId, index) => {
      const hit = Object.values(TOOLS_BY_STEP).flat().find((tool) => tool.id === toolId)
      return {
        id: `${now}-${index}-${toolId}`,
        toolId,
        toolLabel: hit?.label ?? toolId,
        step: Object.entries(TOOLS_BY_STEP).find(([, tools]) => tools.some((t) => t.id === toolId))
          ?.[0] as EditStep || activeStep,
        status: 'queued' as const,
        createdAt: now + index,
      }
    })
    setOperations(loadedOps)
    setEditMessage(`Loaded recipe "${recipe.name}" (${loadedOps.length} steps).`)
  }

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Creation"
        title="Edit"
        description="Refine, enhance, and batch-process your generated content. Apply face fixes, background swaps, upscaling, and more."
        actions={
          <>
            <Button variant="outline" size="lg" asChild>
              <Link href="/gallery">From Gallery</Link>
            </Button>
            <Button size="lg" asChild>
              <Link href="/studio">Generate first</Link>
            </Button>
          </>
        }
        metrics={[
          { label: 'Applied', value: appliedCount },
          { label: 'Queued', value: queuedCount },
          { label: 'Tier', value: activeTier.title },
        ]}
      />

      <div className="flex min-h-[60vh] flex-col overflow-hidden rounded-lg border border-border bg-background">
        {/* Top toolbar */}
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-3">
            <select
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground"
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as 'image' | 'video')}
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            <span className="text-xs text-muted-foreground">100%</span>
            <Button variant="outline" size="sm">
              Preview
            </Button>
            {assetName ? (
              <span className="hidden text-xs text-muted-foreground md:inline">Loaded: {assetName}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={undoLastOperation} disabled={operations.length === 0}>
              <Undo2 className="mr-1 h-3.5 w-3.5" />
              Undo
            </Button>
            <Button variant="outline" size="sm" onClick={resetEditor} disabled={!hasAsset && operations.length === 0}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Reset
            </Button>
            <Button size="sm" disabled={!hasAsset}>
              Apply & export
            </Button>
          </div>
        </div>

        {/* Main three-column area */}
        <div className="flex min-h-0 flex-1">
          {/* Left panel: Library + Navigator */}
          <aside className="flex w-[250px] shrink-0 flex-col border-r border-border bg-muted/20 xl:w-[280px]">
            <Tabs
              value={leftTab}
              onValueChange={(v) => setLeftTab(v as 'library' | 'navigator')}
              className="flex min-h-0 flex-1 flex-col"
            >
              <TabsList className="flex w-full justify-start rounded-none border-b border-border bg-transparent p-0 h-9">
                <TabsTrigger
                  value="library"
                  className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Library
                </TabsTrigger>
                <TabsTrigger
                  value="navigator"
                  className="gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
                >
                  <ListTree className="h-3.5 w-3.5" />
                  Navigator
                </TabsTrigger>
              </TabsList>
              <TabsContent value="library" className="mt-0 flex min-h-0 flex-1 flex-col p-2">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filter tools"
                    value={libraryFilter}
                    onChange={(e) => setLibraryFilter(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Categories
                </div>
                <ul className="space-y-0.5 overflow-y-auto">
                  {EDIT_STEPS.filter(
                    (s) =>
                      !libraryFilter ||
                      s.title.toLowerCase().includes(libraryFilter.toLowerCase())
                  ).map((step) => (
                    <li key={step.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveStep(step.id)
                          setLeftTab('navigator')
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                          activeStep === step.id
                            ? 'bg-primary/15 font-medium text-primary'
                            : 'text-foreground hover:bg-muted'
                        )}
                      >
                        <step.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{step.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 border-t border-border pt-2">
                  <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Source
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                    Upload image / video
                  </Button>
                  <Button variant="ghost" size="sm" className="mt-1 w-full justify-start text-xs" asChild>
                    <Link href="/gallery">From Gallery</Link>
                  </Button>
                </div>
              </TabsContent>
              <TabsContent value="navigator" className="mt-0 flex min-h-0 flex-1 flex-col p-2">
                <div className="flex flex-1 flex-col overflow-y-auto">
                  {EDIT_STEPS.map((step) => (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setActiveStep(step.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
                        activeStep === step.id
                          ? 'bg-primary/15 font-medium text-primary'
                          : 'text-foreground hover:bg-muted'
                      )}
                    >
                      <Eye className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{step.title}</span>
                    </button>
                  ))}
                  <div className="mt-2 border-t border-border pt-2">
                    <Link
                      href="/studio"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                    >
                      <span className="truncate">Back to Studio</span>
                    </Link>
                    <Link
                      href="/gallery"
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                    >
                      <span className="truncate">Gallery</span>
                    </Link>
                  </div>
                </div>
                <p className="mt-2 border-t border-border pt-2 px-1 text-[10px] text-muted-foreground">
                  Select a step to edit
                </p>
              </TabsContent>
            </Tabs>
          </aside>

          {/* Center: Canvas */}
          <section className="flex min-w-0 flex-1 flex-col bg-muted/40">
            <div className="flex flex-1 items-center justify-center p-6">
              <div
                className={cn(
                  'flex h-full w-full max-w-4xl flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/60',
                  hasAsset ? 'border-border' : 'border-primary/30'
                )}
              >
                {hasAsset ? (
                  <>
                    {(assetPreviewUrl || uploadPreviewUrl) ? (
                      <div className="w-full max-w-2xl">
                        {assetType === 'video' ? (
                          <video src={assetPreviewUrl || uploadPreviewUrl || ''} controls className="w-full rounded-lg" />
                        ) : (
                          <img src={assetPreviewUrl || uploadPreviewUrl || ''} alt={assetName || 'Asset'} className="w-full rounded-lg" />
                        )}
                      </div>
                    ) : (
                      <div className="flex h-48 w-64 items-center justify-center rounded-md border border-border bg-muted/80 text-xs text-muted-foreground">
                        Loading preview...
                      </div>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {assetName || 'Asset loaded'} — Use the right panel to apply edits.
                    </p>
                    <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-900 dark:text-amber-200">
                      Edit compute backend is in beta. UI history and queue are active; heavy transforms may return pending status.
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-muted-foreground" />
                    <p className="mt-2 text-sm font-medium text-foreground">
                      Drop an image or video to edit
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Or choose from Library or Gallery
                    </p>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      id="edit-drop-input"
                      onChange={handleFileChange}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => (document.getElementById('edit-drop-input') as HTMLInputElement | null)?.click()}
                    >
                      Browse
                    </Button>
                    <Button variant="ghost" size="sm" className="mt-2" asChild>
                      <Link href="/gallery">From Gallery</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* Right panel: Properties */}
          <aside className="flex w-[320px] shrink-0 flex-col border-l border-border bg-muted/20 xl:w-[360px]">
            <div className="border-b border-border px-3 py-2">
              <h2 className="text-sm font-semibold text-foreground">Properties</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {EDIT_STEPS.find((s) => s.id === activeStep)?.title ?? 'Select a step'}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {appliedCount} applied
                <span className="mx-1">•</span>
                {queuedCount} queued
              </div>
              {editMessage && (
                <p className="mb-2 text-xs text-muted-foreground">{editMessage}</p>
              )}
              <div className="mb-2">
                <Input
                  value={toolFilter}
                  onChange={(e) => setToolFilter(e.target.value)}
                  placeholder="Filter tools in this step"
                  className="h-8 text-xs"
                />
              </div>
              <div className="mb-3 rounded-md border border-border bg-background p-2">
                <p className="text-[11px] font-medium text-foreground">Edit recipes</p>
                <div className="mt-1 flex items-center gap-1.5">
                  <Input
                    value={recipeName}
                    onChange={(e) => setRecipeName(e.target.value)}
                    placeholder="Recipe name"
                    className="h-8 text-xs"
                  />
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={saveRecipe}>
                    Save
                  </Button>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <select
                    className="h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                    value={selectedRecipeId}
                    onChange={(e) => {
                      setSelectedRecipeId(e.target.value)
                      if (e.target.value) loadRecipe(e.target.value)
                    }}
                  >
                    <option value="">Load recipe</option>
                    {recipes.map((recipe) => (
                      <option key={recipe.id} value={recipe.id}>
                        {recipe.name} ({recipe.steps.length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mb-3 rounded-md border border-border bg-background p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-foreground">Batch apply</p>
                  <label className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={batchMode}
                      onChange={(e) => setBatchMode(e.target.checked)}
                    />
                    Enable
                  </label>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Active tier {activeTier.title} supports up to {batchLimit} assets per batch run.
                </p>
                <div className="mt-1 max-h-28 space-y-1 overflow-y-auto pr-1">
                  {galleryAssets.slice(0, 25).map((asset) => (
                    <label key={asset.id} className="flex items-center gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={batchAssetIds.includes(asset.id)}
                        onChange={() => toggleBatchAsset(asset.id)}
                      />
                      <button
                        type="button"
                        className="truncate text-left text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setActiveAssetId(asset.id)
                          setHasAsset(true)
                          setAssetName('Gallery asset')
                          setAssetType(String(asset.type || '').toLowerCase() === 'video' ? 'video' : 'image')
                        }}
                      >
                        {asset.id.slice(0, 8)}...
                      </button>
                    </label>
                  ))}
                  {galleryAssets.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">No gallery assets loaded for this workspace.</p>
                  )}
                </div>
              </div>
              <EditStepProperties
                step={activeStep}
                toolFilter={toolFilter}
                selectedPresetId={selectedPresetId}
                onPresetChange={(toolId, presetId) =>
                  setSelectedPresetId((prev) => ({ ...prev, [toolId]: presetId }))
                }
                onApply={async (toolId, toolLabel) => {
                  if (!hasAsset || !activeAssetId) {
                    setEditMessage('Load or select an asset before applying tools.')
                    return
                  }
                  const targets = batchMode ? batchAssetIds : [activeAssetId]
                  if (targets.length === 0) {
                    setEditMessage('Select at least one gallery asset for batch run.')
                    return
                  }
                  if (targets.length > batchLimit) {
                    setEditMessage(`Your ${billing.plan} plan allows up to ${batchLimit} assets per batch.`)
                    return
                  }
                  setEditMessage(null)
                  const opId = `${Date.now()}-${toolId}`
                  setOperations((prev) => [
                    ...prev,
                    { id: opId, toolId, toolLabel, step: activeStep, status: 'queued', createdAt: Date.now() },
                  ])
                  try {
                    const res = await fetch('/api/edit/apply', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        tool: toolId,
                        assetId: targets[0],
                        assetIds: targets.length > 1 ? targets.slice(1) : [],
                        params: getPresetParams(toolId),
                        recipeName: selectedRecipeId
                          ? recipes.find((r) => r.id === selectedRecipeId)?.name
                          : null,
                      }),
                      credentials: 'include',
                    })
                    const data = await res.json().catch(() => ({}))
                    if (!res.ok) throw new Error((data as { detail?: string }).detail || 'Failed')
                    const queued = Number((data as { queued?: number }).queued || 1)
                    setEditMessage(
                      queued > 1 ? `Queued ${queued} edit jobs for batch processing.` : 'Queued edit job.'
                    )
                    setOperations((prev) => prev.map((op) => (op.id === opId ? { ...op, status: 'applied' } : op)))
                  } catch (error) {
                    setEditMessage(error instanceof Error ? error.message : 'Edit service unavailable.')
                    setOperations((prev) => prev.map((op) => (op.id === opId ? { ...op, status: 'failed' } : op)))
                  }
                }}
              />
              <div className="mt-3 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground">
                <div className="font-medium text-foreground">Step: {stepTitle}</div>
                <div className="mt-0.5">Tip: Use lighter fixes first (restore/denoise), then upscale/export.</div>
              </div>
            </div>
          </aside>
        </div>

        {/* Bottom panel: History / Layers */}
        <div className="shrink-0 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={() => setBottomOpen(!bottomOpen)}
            className="flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/50"
          >
            <span className="flex items-center gap-2">
              {bottomOpen ? (
                <PanelBottomOpen className="h-3.5 w-3.5" />
              ) : (
                <PanelBottomClose className="h-3.5 w-3.5" />
              )}
              {bottomOpen ? 'Edit history' : 'Show history'}
            </span>
          </button>
          {bottomOpen && (
            <Tabs
              value={bottomTab}
              onValueChange={(v) => setBottomTab(v as 'history' | 'layers')}
              className="border-t border-border"
            >
              <TabsList className="h-8 w-full justify-start rounded-none border-b border-border bg-transparent p-0">
                <TabsTrigger
                  value="history"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs"
                >
                  History
                </TabsTrigger>
                <TabsTrigger
                  value="layers"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary text-xs"
                >
                  Layers
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="history"
                className="m-0 h-24 overflow-y-auto p-3 text-[11px] text-muted-foreground"
              >
                {operations.length === 0 ? (
                  <p>No edit steps yet. Load an asset and apply a tool.</p>
                ) : (
                  <ul className="space-y-1">
                    {operations.slice().reverse().map((op) => (
                      <li key={op.id} className="flex items-center justify-between rounded border border-border px-2 py-1">
                        <span className="truncate pr-2">{op.toolLabel}</span>
                        <span
                          className={cn(
                            'uppercase',
                            op.status === 'applied' && 'text-emerald-600',
                            op.status === 'failed' && 'text-amber-600',
                            op.status === 'queued' && 'text-muted-foreground'
                          )}
                        >
                          {op.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent
                value="layers"
                className="m-0 h-24 overflow-y-auto p-3 text-[11px] text-muted-foreground"
              >
                {hasAsset ? (
                  <div className="space-y-1">
                    <p>Base layer ({assetType})</p>
                    <p className="text-[10px]">Applied ops: {appliedCount}</p>
                  </div>
                ) : (
                  <p>Layer-based editing available in Canvas mode.</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  )
}

function EditStepProperties({
  step,
  toolFilter,
  selectedPresetId,
  onPresetChange,
  onApply,
}: {
  step: EditStep
  toolFilter?: string
  selectedPresetId?: Record<string, string>
  onPresetChange?: (toolId: string, presetId: string) => void
  onApply?: (toolId: string, toolLabel: string) => void
}) {
  const tools = (TOOLS_BY_STEP[step] ?? []).filter((t) =>
    toolFilter ? `${t.label} ${t.desc}`.toLowerCase().includes(toolFilter.toLowerCase()) : true
  )

  return (
    <div className="space-y-3">
      {tools.map((t) => (
        <div
          key={t.id}
          className="flex items-start justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-muted/50"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{t.label}</p>
            <p className="text-[11px] text-muted-foreground">{t.desc}</p>
            {(TOOL_PRESETS[t.id] ?? []).length > 0 && (
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1 text-[11px]"
                value={selectedPresetId?.[t.id] ?? ''}
                onChange={(e) => onPresetChange?.(t.id, e.target.value)}
              >
                <option value="">No preset</option>
                {(TOOL_PRESETS[t.id] ?? []).map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => onApply?.(t.id, t.label)}
          >
            Apply
          </Button>
        </div>
      ))}
      {tools.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
          <AlertCircle className="mr-1 inline h-3.5 w-3.5" />
          No tools match this filter.
        </div>
      )}
      {step === 'face' && (
        <div className="pt-2">
          <Label className="text-[11px] text-muted-foreground">Reference face (optional)</Label>
          <Input className="mt-1 h-8 text-xs" placeholder="Upload or select influencer" />
        </div>
      )}
      {step === 'background' && (
        <div className="pt-2">
          <Label className="text-[11px] text-muted-foreground">Replace with</Label>
          <select className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs">
            <option>Preset scene</option>
            <option>Custom image</option>
            <option>Blur only</option>
          </select>
        </div>
      )}
      {step === 'enhance' && (
        <div className="pt-2">
          <Label className="text-[11px] text-muted-foreground">Upscale factor</Label>
          <select className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs">
            <option>2x</option>
            <option>4x</option>
            <option>8x</option>
          </select>
        </div>
      )}
    </div>
  )
}

