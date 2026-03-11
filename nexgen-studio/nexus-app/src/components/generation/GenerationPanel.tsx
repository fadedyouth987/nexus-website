'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useGenerationSettings } from '@/context/GenerationContext'
import { LoRATab } from './LoRATab'
import { ModelTab } from './ModelTab'
import { SamplerTab } from './SamplerTab'
import { ControlNetTab } from './ControlNetTab'
import { AdvancedTab } from './AdvancedTab'
import apiFetch from '@/lib/core/api'
import { generationOutputLimitByPlan, normalizePlan } from '@/lib/billing/planLimits'

const checkpoints = [
  { value: 'sd15', label: 'Stable Diffusion 1.5' },
  { value: 'sd21', label: 'Stable Diffusion 2.1' },
  { value: 'sdxl', label: 'SDXL 1.0' },
  { value: 'pony', label: 'Pony Diffusion' },
  { value: 'realistic', label: 'Realistic Vision' },
]

const vaeOptions = [
  { value: 'Auto', label: 'Auto' },
  { value: 'vae840000', label: 'VAE 840000' },
  { value: 'vaeft', label: 'VAE FT-MSE' },
  { value: 'kl-f8', label: 'KL-F8' },
]

const widthOptions = [256, 512, 768, 1024, 1280, 1536]
const heightOptions = [256, 512, 768, 1024, 1280, 1536]

type BillingPayload = {
  plan?: string | null
}

export function GenerationPanel() {
  const { settings, updateSetting, resetSettings, exportSettings } = useGenerationSettings()
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState('')
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const [planTier, setPlanTier] = useState('STARTER')
  const [batchLimit, setBatchLimit] = useState(generationOutputLimitByPlan('STARTER'))

  useEffect(() => {
    let cancelled = false
    apiFetch('/billing/me')
      .then(async (response) => {
        if (!response.ok || cancelled) return
        const payload = (await response.json().catch(() => ({}))) as BillingPayload
        if (cancelled) return
        const normalized = normalizePlan(payload?.plan)
        setPlanTier(normalized)
        setBatchLimit(generationOutputLimitByPlan(normalized))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const handleGenerate = async () => {
    setIsGenerating(true)
    setStatus('Initializing...')
    setLastJobId(null)
    try {
      const requestedBatch = Math.max(1, Math.min(batchLimit, Math.floor(settings.batchSize)))
      const payload = {
        positive: 'masterpiece, best quality',
        negative: 'worst quality, low quality',
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
        const data = await response.json().catch(() => ({}))
        throw new Error(typeof data.detail === 'string' ? data.detail : 'Generation failed')
      }
      const data = (await response.json()) as { jobId?: string; id?: string }
      const jobId = data.jobId ?? data.id ?? null
      if (jobId) setLastJobId(jobId)
      setStatus('Generation started!')
    } catch (error) {
      setStatus('Error: ' + (error as Error).message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle>Image Generation</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetSettings}>
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={() => console.log(exportSettings())}>
              Export
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Plan {planTier}: up to {batchLimit} outputs per request.</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="model" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="model">Model</TabsTrigger>
            <TabsTrigger value="sampler">Sampler</TabsTrigger>
            <TabsTrigger value="lora">LoRA</TabsTrigger>
            <TabsTrigger value="controlnet">ControlNet</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          
          <TabsContent value="model" className="mt-4">
            <ModelTab />
          </TabsContent>
          
          <TabsContent value="sampler" className="mt-4">
            <SamplerTab maxBatchSize={batchLimit} planLabel={planTier} />
          </TabsContent>
          
          <TabsContent value="lora" className="mt-4">
            <LoRATab />
          </TabsContent>
          
          <TabsContent value="controlnet" className="mt-4">
            <ControlNetTab />
          </TabsContent>
          
          <TabsContent value="advanced" className="mt-4">
            <AdvancedTab />
          </TabsContent>
        </Tabs>
        
        {/* Generate Button */}
        <div className="mt-6 pt-4 border-t space-y-2">
          <Button 
            className="w-full" 
            size="lg"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? status || 'Generating...' : 'Generate Image'}
          </Button>
          {lastJobId && !isGenerating && (
            <p className="text-center text-sm text-muted-foreground">
              <Link href={`/generations/${lastJobId}`} className="underline hover:text-foreground">
                View job status
              </Link>
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
