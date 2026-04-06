'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import apiFetch from '@/lib/core/api'
import { useWorkspace } from '@/context/WorkspaceContext'
import { AppHero } from '@/components/layout/AppHero'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Loader2, RefreshCw } from 'lucide-react'

type Influencer = {
  id: string
  name?: string | null
  display_name?: string | null
  handle?: string | null
}

type WorkflowVariable = {
  default?: unknown
  min?: number
  max?: number
  step?: number
  options?: string[]
}

type WorkflowUiField = {
  label?: string
  type?: 'text' | 'textarea' | 'slider' | 'select'
}

type WorkflowTemplate = {
  id: string
  slug: string
  name: string
  type: 'IMAGE' | 'VIDEO'
  content_policy: 'SFW' | 'NSFW'
  variables_json: unknown
  ui_schema_json: unknown
  comfy_workflow_json: unknown
}

type WorkflowTemplatesResponse = {
  items: WorkflowTemplate[]
}

type GenerationAsset = {
  id: string
  kind: 'IMAGE' | 'VIDEO' | string
}

type GenerationJobResponse = {
  job?: Record<string, unknown>
  assets?: GenerationAsset[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeWorkflowVariables(raw: unknown): Record<string, WorkflowVariable> {
  if (!isRecord(raw)) return {}

  const normalized: Record<string, WorkflowVariable> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (isRecord(value)) {
      normalized[key] = {
        default: value.default,
        min: typeof value.min === 'number' ? value.min : undefined,
        max: typeof value.max === 'number' ? value.max : undefined,
        step: typeof value.step === 'number' ? value.step : undefined,
        options: Array.isArray(value.options)
          ? value.options.filter((option): option is string => typeof option === 'string')
          : undefined,
      }
      continue
    }

    normalized[key] = { default: value }
  }

  return normalized
}

function normalizeUiSchema(raw: unknown): Record<string, WorkflowUiField> {
  if (!isRecord(raw)) return {}

  const normalized: Record<string, WorkflowUiField> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isRecord(value)) continue
    const type = value.type
    normalized[key] = {
      label: typeof value.label === 'string' ? value.label : undefined,
      type:
        type === 'text' || type === 'textarea' || type === 'slider' || type === 'select'
          ? type
          : undefined,
    }
  }

  return normalized
}

export default function ProductionPage() {
  const { status } = useSession()
  const router = useRouter()
  const { currentWorkspace, isLoading: workspaceLoading } = useWorkspace()
  const eventSourceRef = useRef<EventSource | null>(null)

  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([])
  const [selectedInfluencer, setSelectedInfluencer] = useState('')
  const [selectedWorkflow, setSelectedWorkflow] = useState('')

  const [workflowVars, setWorkflowVars] = useState<Record<string, WorkflowVariable>>({})
  const [uiSchema, setUiSchema] = useState<Record<string, WorkflowUiField>>({})
  const [formValues, setFormValues] = useState<Record<string, unknown>>({})

  const [expertMode, setExpertMode] = useState(false)
  const [graphJson, setGraphJson] = useState<Record<string, unknown> | null>(null)

  const [jobId, setJobId] = useState<string | null>(null)
  const [progress, setProgress] = useState<Record<string, unknown> | null>(null)
  const [assets, setAssets] = useState<GenerationAsset[]>([])
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({})

  const [initialLoading, setInitialLoading] = useState(true)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedWorkflowTemplate = useMemo(
    () => workflows.find((workflow) => workflow.id === selectedWorkflow) || null,
    [workflows, selectedWorkflow]
  )

  const formKeys = useMemo(() => {
    const keys = new Set<string>([...Object.keys(workflowVars), ...Object.keys(uiSchema)])
    return Array.from(keys)
  }, [workflowVars, uiSchema])

  const closeProgressStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  // #region agent log
  const debugLog = useCallback(
    (hypothesisId: string, message: string, data: Record<string, unknown> = {}, runId = 'run2') => {
      fetch('http://127.0.0.1:7810/ingest/e1fb0ad9-95e8-422a-bd38-81f121a8c64c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a5e906'},body:JSON.stringify({sessionId:'a5e906',runId,hypothesisId,location:'src/app/production/page.tsx',message,data,timestamp:Date.now()})}).catch(()=>{})
    },
    []
  )
  // #endregion

  const fetchInitialData = useCallback(async () => {
    if (!currentWorkspace?.id) return

    // #region agent log
    debugLog('H2', 'fetchInitialData:start', { workspaceId: currentWorkspace.id })
    // #endregion

    setInitialLoading(true)
    setError(null)

    try {
      const [influencerResponse, workflowResponse] = await Promise.all([
        apiFetch(`/workspaces/${currentWorkspace.id}/influencers`),
        apiFetch('/workflow-templates'),
      ])

      if (!influencerResponse.ok) {
        const payload = await influencerResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load influencers')
      }

      if (!workflowResponse.ok) {
        const payload = await workflowResponse.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to load workflows')
      }

      const influencerPayload = (await influencerResponse.json()) as Influencer[]
      const workflowPayload = (await workflowResponse.json()) as WorkflowTemplatesResponse | WorkflowTemplate[]
      const workflowItems = Array.isArray(workflowPayload)
        ? workflowPayload
        : workflowPayload.items || []

      setInfluencers(influencerPayload || [])
      setWorkflows(workflowItems)
      // #region agent log
      debugLog('H2', 'fetchInitialData:success', {
        influencerCount: influencerPayload?.length ?? -1,
        workflowCount: workflowItems?.length ?? -1,
      })
      // #endregion
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load production tools')
      // #region agent log
      debugLog('H2', 'fetchInitialData:error', {
        error: loadError instanceof Error ? loadError.message : 'unknown',
      })
      // #endregion
    } finally {
      setInitialLoading(false)
    }
  }, [currentWorkspace?.id, debugLog])

  useEffect(() => {
    if (!selectedInfluencer && influencers[0]) {
      setSelectedInfluencer(influencers[0].id)
    }
  }, [influencers, selectedInfluencer])

  useEffect(() => {
    if (!selectedWorkflow && workflows[0]) {
      setSelectedWorkflow(workflows[0].id)
    }
  }, [workflows, selectedWorkflow])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth')
      return
    }

    if (status === 'authenticated' && currentWorkspace?.id && !workspaceLoading) {
      void fetchInitialData()
    }
  }, [status, currentWorkspace?.id, workspaceLoading, router, fetchInitialData])

  useEffect(() => {
    if (!selectedWorkflowTemplate) {
      setWorkflowVars({})
      setUiSchema({})
      setFormValues({})
      setGraphJson(null)
      return
    }

    const variables = normalizeWorkflowVariables(selectedWorkflowTemplate.variables_json)
    const schema = normalizeUiSchema(selectedWorkflowTemplate.ui_schema_json)
    const defaults: Record<string, unknown> = {}

    for (const [key, spec] of Object.entries(variables)) {
      if (spec.default !== undefined) {
        defaults[key] = spec.default
      }
    }

    setWorkflowVars(variables)
    setUiSchema(schema)
    setGraphJson(
      isRecord(selectedWorkflowTemplate.comfy_workflow_json)
        ? selectedWorkflowTemplate.comfy_workflow_json
        : null
    )
    setFormValues(defaults)
  }, [selectedWorkflowTemplate])

  useEffect(() => () => closeProgressStream(), [closeProgressStream])

  const updateField = useCallback((key: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const loadJobDetails = useCallback(async (id: string) => {
    try {
      const response = await apiFetch(`/generate/${id}`)
      if (!response.ok) {
        return
      }

      const payload = (await response.json()) as GenerationJobResponse
      const nextAssets = Array.isArray(payload.assets) ? payload.assets : []
      const nextJob = isRecord(payload.job) ? payload.job : null

      setAssets(nextAssets)
      setProgress(
        nextJob && isRecord(nextJob.progress_json)
          ? (nextJob.progress_json as Record<string, unknown>)
          : { status: typeof nextJob?.status === 'string' ? nextJob.status : 'UNKNOWN' }
      )

      const resolvedUrls = await Promise.all(
        nextAssets.map(async (asset) => {
          try {
            const signedResponse = await apiFetch(`/assets/${asset.id}/signed-url`)
            if (!signedResponse.ok) return null

            const signedPayload = (await signedResponse.json()) as { signedUrl?: string }
            if (typeof signedPayload.signedUrl !== 'string') return null
            return [asset.id, signedPayload.signedUrl] as const
          } catch {
            return null
          }
        })
      )

      const urlMap: Record<string, string> = {}
      for (const entry of resolvedUrls) {
        if (!entry) continue
        urlMap[entry[0]] = entry[1]
      }

      setAssetUrls(urlMap)
    } catch {
      // Keep existing UI state if detail lookup fails.
    }
  }, [])

  const subscribeToProgress = useCallback((id: string) => {
    closeProgressStream()
    const eventSource = new EventSource(`/api/generate/${id}/events`)
    eventSourceRef.current = eventSource

    const parseEvent = (event: MessageEvent<string>) => {
      try {
        return JSON.parse(event.data) as Record<string, unknown>
      } catch {
        return null
      }
    }

    const handleStatus = (statusValue: unknown) => {
      if (statusValue === 'READY' || statusValue === 'FAILED') {
        closeProgressStream()
        void loadJobDetails(id)
      }
    }

    eventSource.addEventListener('snapshot', (event) => {
      const payload = parseEvent(event as MessageEvent<string>)
      if (!payload || !isRecord(payload.job)) return

      const job = payload.job as Record<string, unknown>
      if (isRecord(job.progress_json)) {
        setProgress(job.progress_json as Record<string, unknown>)
      } else if (typeof job.status === 'string') {
        setProgress({ status: job.status })
      }

      handleStatus(job.status)
    })

    eventSource.addEventListener('progress', (event) => {
      const payload = parseEvent(event as MessageEvent<string>)
      if (!payload) return
      setProgress(payload)
    })

    eventSource.addEventListener('status', (event) => {
      const payload = parseEvent(event as MessageEvent<string>)
      if (!payload) return
      setProgress(payload)
      handleStatus(payload.status)
    })

    eventSource.onerror = () => {
      closeProgressStream()
    }
  }, [closeProgressStream, loadJobDetails])

  const startGeneration = useCallback(async () => {
    if (!selectedInfluencer || !selectedWorkflowTemplate) return

    // #region agent log
    debugLog('H3', 'startGeneration:start', {
      influencer: selectedInfluencer,
      workflow: selectedWorkflowTemplate.id,
      inputKeys: Object.keys(formValues).length,
      expertMode,
    })
    // #endregion

    setSubmitLoading(true)
    setError(null)
    setAssets([])
    setAssetUrls({})
    setProgress({ status: 'QUEUED' })

    try {
      const response = await apiFetch('/generate', {
        method: 'POST',
        body: JSON.stringify({
          influencerId: selectedInfluencer,
          workflowTemplateId: selectedWorkflowTemplate.id,
          mode: selectedWorkflowTemplate.type,
          inputs: formValues,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.detail || 'Failed to start generation')
      }

      const payload = (await response.json()) as { jobId?: string }
      if (!payload.jobId) {
        throw new Error('Generation job id missing in response')
      }

      setJobId(payload.jobId)
      subscribeToProgress(payload.jobId)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to start generation')
      setProgress(null)
      // #region agent log
      debugLog('H3', 'startGeneration:error', {
        error: submitError instanceof Error ? submitError.message : 'unknown',
      })
      // #endregion
    } finally {
      setSubmitLoading(false)
    }
  }, [debugLog, expertMode, formValues, selectedInfluencer, selectedWorkflowTemplate, subscribeToProgress])

  useEffect(() => {
    // #region agent log
    debugLog('H1', 'render:state', {
      status,
      workspaceLoading,
      initialLoading,
      hasWorkspace: Boolean(currentWorkspace?.id),
      hasError: Boolean(error),
      hasJobId: Boolean(jobId),
    })
    // #endregion
  }, [currentWorkspace?.id, debugLog, error, initialLoading, jobId, status, workspaceLoading])

  if (status === 'loading' || workspaceLoading || initialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Redirecting to login...
      </div>
    )
  }

  if (!currentWorkspace?.id) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Select a workspace to start generating.
      </div>
    )
  }

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Creation"
        title="Production"
        description="Advanced generation workflow execution. Select a template, configure parameters, and run batch jobs on the GPU cluster."
        metrics={[
          { label: 'Influencers', value: influencers.length },
          { label: 'Workflows', value: workflows.length },
        ]}
      />

      <div className="flex h-[calc(100vh-14rem)] min-h-[640px] rounded-xl border border-border/80 shadow-sm overflow-hidden bg-background">
      <div className="w-72 border-r p-4 space-y-4 overflow-y-auto bg-background">
        <Card>
          <CardHeader>
            <CardTitle>Influencer</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select
              value={selectedInfluencer || undefined}
              onValueChange={setSelectedInfluencer}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select influencer" />
              </SelectTrigger>
              <SelectContent>
                {influencers.map((influencer) => (
                  <SelectItem key={influencer.id} value={influencer.id}>
                    {influencer.name || influencer.display_name || influencer.handle || influencer.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!influencers.length ? (
              <p className="text-xs text-muted-foreground">No influencers available in this workspace.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select
              value={selectedWorkflow || undefined}
              onValueChange={setSelectedWorkflow}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select workflow" />
              </SelectTrigger>
              <SelectContent>
                {workflows.map((workflow) => (
                  <SelectItem key={workflow.id} value={workflow.id}>
                    {workflow.name} {workflow.content_policy === 'NSFW' ? '[Vault]' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!workflows.length ? (
              <p className="text-xs text-muted-foreground">No active workflows available for this account.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expert Mode</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Show raw workflow graph</span>
            <Switch checked={expertMode} onCheckedChange={setExpertMode} />
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full gap-2" onClick={() => void fetchInitialData()}>
          <RefreshCw className="h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-6">
        {error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4 text-sm text-red-700">{error}</CardContent>
          </Card>
        ) : null}

        {!expertMode ? (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold">Form Mode</h2>

            {!selectedWorkflowTemplate ? (
              <Card>
                <CardContent className="py-8 text-sm text-muted-foreground">
                  Select a workflow to configure generation inputs.
                </CardContent>
              </Card>
            ) : (
              <Accordion type="multiple" className="w-full">
                {formKeys.map((key) => {
                  const schema = uiSchema[key] || {}
                  const variable = workflowVars[key] || {}
                  const type =
                    schema.type ||
                    (variable.options?.length ? 'select' : 'text')

                  const label = schema.label || key

                  return (
                    <AccordionItem key={key} value={key}>
                      <AccordionTrigger>{label}</AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        {type === 'text' ? (
                          <Input
                            value={String(formValues[key] ?? '')}
                            onChange={(event) => updateField(key, event.target.value)}
                          />
                        ) : null}

                        {type === 'textarea' ? (
                          <Textarea
                            value={String(formValues[key] ?? '')}
                            onChange={(event) => updateField(key, event.target.value)}
                          />
                        ) : null}

                        {type === 'slider' ? (
                          <div className="space-y-2">
                            <Slider
                              value={[
                                toNumber(
                                  formValues[key],
                                  toNumber(variable.default, toNumber(variable.min, 0))
                                ),
                              ]}
                              min={toNumber(variable.min, 0)}
                              max={toNumber(variable.max, 100)}
                              step={toNumber(variable.step, 1)}
                              onValueChange={(value) => updateField(key, value[0])}
                            />
                            <p className="text-xs text-muted-foreground">
                              Value: {String(formValues[key] ?? variable.default ?? 0)}
                            </p>
                          </div>
                        ) : null}

                        {type === 'select' ? (
                          <Select
                            value={
                              typeof formValues[key] === 'string'
                                ? (formValues[key] as string)
                                : undefined
                            }
                            onValueChange={(value) => updateField(key, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent>
                              {(variable.options || []).map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : null}
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            )}

            <Button
              onClick={() => void startGeneration()}
              disabled={!selectedInfluencer || !selectedWorkflowTemplate || submitLoading}
            >
              {submitLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Starting...
                </span>
              ) : (
                `Generate ${selectedWorkflowTemplate?.type === 'VIDEO' ? 'Video' : 'Image'}`
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Expert Mode</h2>
            <pre className="rounded-lg bg-black text-white p-4 text-xs overflow-x-auto">
              {JSON.stringify(graphJson, null, 2)}
            </pre>
          </div>
        )}

        {progress ? (
          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(() => {
                const status = typeof progress.status === 'string' ? progress.status : 'UNKNOWN'
                const percent = typeof progress.percent === 'number' ? progress.percent : null
                const message = typeof progress.message === 'string' ? progress.message : null
                const isRunning = status === 'RUNNING' || status === 'PROCESSING'
                const isDone = status === 'READY' || status === 'COMPLETED'
                const isFailed = status === 'FAILED' || status === 'ERROR'
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        isDone ? 'bg-emerald-500/10 text-emerald-600' :
                        isFailed ? 'bg-destructive/10 text-destructive' :
                        isRunning ? 'bg-primary/10 text-primary' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {isDone && '✓'} {isFailed && '✕'} {isRunning && '●'} {status}
                      </span>
                      {message && <span className="text-sm text-muted-foreground">{message}</span>}
                    </div>
                    {(percent !== null || isRunning) && (
                      <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${isDone ? 'bg-emerald-500' : isFailed ? 'bg-destructive' : 'bg-primary'}`}
                          style={{ width: `${isDone ? 100 : (percent ?? 0)}%` }}
                        />
                      </div>
                    )}
                    {percent !== null && <p className="text-xs text-muted-foreground">{percent}% complete</p>}
                  </>
                )
              })()}
            </CardContent>
          </Card>
        ) : null}

        {assets.length ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {assets.map((asset) => {
              const url = assetUrls[asset.id]
              return (
                <Card key={asset.id}>
                  <CardContent className="p-3">
                    {!url ? (
                      <div className="flex h-56 items-center justify-center rounded bg-muted text-sm text-muted-foreground">
                        Resolving signed URL...
                      </div>
                    ) : asset.kind === 'VIDEO' ? (
                      <video src={url} controls className="w-full rounded" />
                    ) : (
                      <img src={url} alt="Generated asset" className="w-full rounded" />
                    )}
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
                        <Link href={`/edit?assetId=${asset.id}`}>Edit</Link>
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
                        <Link href="/automation/planner">Schedule</Link>
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
                        <Link href="/gallery">Gallery</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="w-80 border-l p-4 overflow-y-auto space-y-3">
        <h3 className="text-xl font-semibold">Inspector</h3>
        <p className="text-sm text-muted-foreground">
          Live details from the selected workflow and the latest generation job.
        </p>
        <div className="space-y-2 text-sm">
          <div><span className="text-muted-foreground">Job:</span> {jobId || 'n/a'}</div>
          <div><span className="text-muted-foreground">Workflow:</span> {selectedWorkflowTemplate?.name || 'n/a'}</div>
          <div><span className="text-muted-foreground">Mode:</span> {selectedWorkflowTemplate?.type || 'n/a'}</div>
          <div><span className="text-muted-foreground">Policy:</span> {selectedWorkflowTemplate?.content_policy || 'n/a'}</div>
          <div><span className="text-muted-foreground">Assets:</span> {assets.length}</div>
        </div>
      </div>
      </div>
    </div>
  )
}
