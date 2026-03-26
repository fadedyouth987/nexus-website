'use client'

import { useEffect, useState } from 'react'
import { useGenerationSettings } from '@/context/GenerationContext'
import { useOrganization } from '@/context/OrganizationContext'
import apiFetch from '@/lib/core/api'
import { generationOutputLimitByPlan, normalizePlan } from '@/lib/billing/planLimits'
import { GenerationPanel } from '../GenerationPanel'
import { PromptEditor } from './PromptEditor'
import { ViewportPreview } from './ViewportPreview'
import { RecentRunsRail } from './RecentRunsRail'

type BillingPayload = {
  plan?: string | null
  tokenBalance?: number | null
}

export function StudioWorkspaceView() {
  const { settings } = useGenerationSettings()
  const { organization, loading: orgLoading } = useOrganization()
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusKind, setStatusKind] = useState<'idle' | 'progress' | 'success' | 'error'>('idle')
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  
  const [planTier, setPlanTier] = useState('STARTER')
  const [tokenBalance, setTokenBalance] = useState<number | null>(null)
  const [batchLimit, setBatchLimit] = useState(generationOutputLimitByPlan('STARTER'))

  useEffect(() => {
    let cancelled = false

    setPlanTier('STARTER')
    setTokenBalance(null)
    setBatchLimit(generationOutputLimitByPlan('STARTER'))

    if (orgLoading || !organization?.id) {
      return () => {
        cancelled = true
      }
    }

    const billingPath = `/billing/me?org_id=${encodeURIComponent(organization.id)}`

    apiFetch(billingPath)
      .then(async (response) => {
        if (!response.ok || cancelled) return
        const payload = (await response.json().catch(() => ({}))) as BillingPayload
        if (cancelled) return

        const normalized = normalizePlan(payload?.plan)
        setPlanTier(normalized)
        setTokenBalance(typeof payload?.tokenBalance === 'number' ? payload.tokenBalance : null)
        setBatchLimit(generationOutputLimitByPlan(normalized))
      })
      .catch((err) => console.warn('Failed to fetch billing info', err))

    return () => {
      cancelled = true
    }
  }, [orgLoading, organization?.id])

  const handleGenerate = async () => {
    if (!organization?.id) {
      setStatusMessage('Select an organization before generating.')
      setStatusKind('error')
      return
    }
    setIsGenerating(true)
    setStatusMessage('Initializing payload...')
    setStatusKind('progress')
    setLastJobId(null)
    try {
      const rawBatch =
        typeof settings.batchSize === 'number' && Number.isFinite(settings.batchSize)
          ? settings.batchSize
          : 1
      const requestedBatch = Math.max(1, Math.min(batchLimit, Math.floor(rawBatch)))

      const payload = {
        org_id: organization.id,
        positive: settings.prompt || 'masterpiece, best quality',
        negative: settings.negativePrompt || 'worst quality, low quality',
        steps: settings.steps,
        cfg: settings.cfg,
        seed: settings.seed,
        sampler_name: settings.sampler,
        scheduler: settings.scheduler,
        denoise: settings.denoise,
        width: settings.width,
        height: settings.height,
        batch_size: requestedBatch,
        model: settings.checkpoint,
        vae: settings.vae,
        loras: settings.loras.filter(l => l.enabled).map(l => ({
          name: l.name,
          path: l.path,
          strength: l.strength,
        })),
        controlnet: settings.controlnetEnabled ? {
          model: settings.controlnetModel,
          preprocessor: settings.controlnetPreprocessor,
          strength: settings.controlnetStrength,
        } : null,
      }
      const response = await apiFetch('/ai/generate-image', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        if (response.status === 402) {
          throw new Error('Insufficient tokens. Please upgrade your plan or top up your balance.')
        }
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Generation failed')
      }
      const data = (await response.json()) as { jobId?: string; id?: string }
      const jobId = data.jobId ?? data.id ?? null
      if (jobId) setLastJobId(jobId)
      setStatusMessage('Job queued successfully')
      setStatusKind('success')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Generation failed')
      setStatusKind('error')
    } finally {
      setIsGenerating(false)
    }
  }

  const isGenerateDisabled = isGenerating || orgLoading || !organization?.id || (tokenBalance !== null && tokenBalance <= 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-6 items-start h-full pb-8">
      {/* Left Area: Viewport, Prompt, Recent Runs */}
      <div className="flex flex-col gap-6 min-w-0">
        <ViewportPreview 
          isGenerating={isGenerating} 
          status={statusMessage} 
          lastJobId={lastJobId} 
        />
        <PromptEditor 
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          isGenerateDisabled={isGenerateDisabled}
          statusMessage={statusMessage}
          statusKind={statusKind}
          orgLoading={orgLoading}
          hasOrganization={!!organization?.id}
          tokenBalance={tokenBalance}
        />
        <RecentRunsRail lastJobId={lastJobId} />
      </div>

      {/* Right Area: Controls Rail */}
      <div className="flex flex-col gap-6 w-full lg:sticky lg:top-6 lg:h-[calc(100vh-200px)]">
        <GenerationPanel 
          planTier={planTier} 
          batchLimit={batchLimit} 
          tokenBalance={tokenBalance} 
        />
      </div>
    </div>
  )
}
