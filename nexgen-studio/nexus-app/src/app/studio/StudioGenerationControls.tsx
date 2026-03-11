'use client'

import { useState, useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2 } from 'lucide-react'

const SAMPLERS = ['euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral', 'lms', 'dpm_fast', 'dpm_adaptive', 'dpmpp_2s_ancestral', 'dpmpp_2m', 'dpmpp_sde', 'ddim', 'uni_pc', 'uni_pc_bh2']
const SCHEDULERS = ['normal', 'karras', 'exponential', 'sgm_uniform', 'simple', 'turbo']
const VAE_OPTIONS = ['default', 'vae-ft-mse-840000', 'sdxl-vae-fp16-fix', 'kl-f8-anime2']
const CONTROLNET_PREPROCESSORS = ['pose', 'canny', 'depth', 'openpose', 'lineart', 'scribble', 'tile', 'inpaint']
const IP_ADAPTER_MODELS = ['ip-adapter_sd15', 'ip-adapter_sdxl', 'ip-adapter_plus_face_sd15', 'ip-adapter_plus_face_sdxl']
const CONTROLNET_MODELS = ['controlnet-sd15-openpose', 'controlnet-sd15-canny', 'controlnet-sd15-depth', 'controlnet-sdxl-openpose', 'controlnet-sdxl-canny']

const MODEL_OPTIONS = [
  { value: 'sd1', label: 'SD 1.0' },
  { value: 'sd15', label: 'SD 1.5' },
  { value: 'sdxl', label: 'SDXL' },
  { value: 'flux', label: 'FLUX' },
  { value: 'kling', label: 'Kling (video)' },
  { value: 'nano', label: 'Luma Nano (video)' },
  { value: 'banana', label: 'Banana (video)' },
  { value: 'custom', label: 'Custom path' },
] as const

const VIDEO_WORKFLOW_IDS = ['animatediff', 'kling', 'nano', 'banana'] as const
const DURATION_OPTIONS = [
  { value: 5, label: '5 seconds' },
  { value: 10, label: '10 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '60 seconds' },
] as const

type LoraRow = { id: string; model: string; strength: number }

export interface StudioGenerationControlsProps {
  selectedWorkflowId?: string
  customWorkflowJson?: Record<string, unknown> | null
  presetModelId?: string
  batchLimit?: number
  /** Callback when video duration limit changes (for generation payload). */
  onDurationLimitChange?: (seconds: number) => void
}

export interface StudioGenerationControlsRef {
  getValues(): { prompt: string; negativePrompt: string; outputCount: number }
  setValues(values: { prompt?: string; negativePrompt?: string; outputCount?: number }): void
}

export const StudioGenerationControls = forwardRef<
  StudioGenerationControlsRef,
  StudioGenerationControlsProps
>(function StudioGenerationControls(
  {
    selectedWorkflowId,
    customWorkflowJson,
    presetModelId = 'sdxl',
    batchLimit = 2,
    onDurationLimitChange,
  } = {},
  ref
) {
  const [prompt, setPrompt] = useState('')
  const [modelId, setModelId] = useState<string>(presetModelId)
  const [customCheckpointPath, setCustomCheckpointPath] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [steps, setSteps] = useState([20])
  const [cfg, setCfg] = useState([7.5])
  const [denoise, setDenoise] = useState([1])
  const [seed, setSeed] = useState('')
  const [sampler, setSampler] = useState('euler')
  const [scheduler, setScheduler] = useState('normal')
  const [vae, setVae] = useState('default')
  const [durationLimit, setDurationLimit] = useState(10)
  const [outputCount, setOutputCount] = useState(1)

  const outputMax = Math.max(1, Math.floor(batchLimit))
  const effectiveOutputCount = Math.max(1, Math.min(outputMax, Math.floor(outputCount)))

  const isVideoWorkflow =
    selectedWorkflowId && (VIDEO_WORKFLOW_IDS as readonly string[]).includes(selectedWorkflowId) ||
    (modelId === 'kling' || modelId === 'nano' || modelId === 'banana')

  const [loras, setLoras] = useState<LoraRow[]>([{ id: '1', model: 'none', strength: 0.8 }])
  const addLora = () => setLoras((prev) => [...prev, { id: String(Date.now()), model: 'none', strength: 0.8 }])
  const removeLora = (id: string) => setLoras((prev) => prev.filter((r) => r.id !== id))
  const setLoraModel = (id: string, model: string) =>
    setLoras((prev) => prev.map((r) => (r.id === id ? { ...r, model } : r)))
  const setLoraStrength = (id: string, strength: number) =>
    setLoras((prev) => prev.map((r) => (r.id === id ? { ...r, strength } : r)))

  const [ipAdapterEnabled, setIpAdapterEnabled] = useState(false)
  const [ipAdapterModel, setIpAdapterModel] = useState('ip-adapter_sd15')
  const [ipAdapterWeight, setIpAdapterWeight] = useState([0.8])

  const [controlNetEnabled, setControlNetEnabled] = useState(false)
  const [controlNetModel, setControlNetModel] = useState('controlnet-sd15-openpose')
  const [controlNetPreprocessor, setControlNetPreprocessor] = useState('pose')
  const [controlNetStrength, setControlNetStrength] = useState([1])

  const [poseStrength, setPoseStrength] = useState([1])

  useEffect(() => {
    if (!presetModelId || !MODEL_OPTIONS.some((o) => o.value === presetModelId) || modelId === presetModelId) {
      return
    }
    const timer = setTimeout(() => {
      setModelId(presetModelId)
    }, 0)
    return () => {
      clearTimeout(timer)
    }
  }, [presetModelId, modelId])

  useImperativeHandle(ref, () => ({
    getValues() {
      return { prompt, negativePrompt, outputCount: effectiveOutputCount }
    },
    setValues(values: { prompt?: string; negativePrompt?: string; outputCount?: number }) {
      if (values.prompt !== undefined) setPrompt(values.prompt)
      if (values.negativePrompt !== undefined) setNegativePrompt(values.negativePrompt)
      if (values.outputCount !== undefined) {
        setOutputCount(Math.max(1, Math.min(outputMax, Math.floor(values.outputCount))))
      }
    },
  }), [prompt, negativePrompt, effectiveOutputCount, outputMax])

  const handleDurationChange = (seconds: number) => {
    setDurationLimit(seconds)
    onDurationLimitChange?.(seconds)
  }

  return (
    <div className="space-y-4">
      {/* Model */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Model</CardTitle>
          <p className="text-xs text-muted-foreground">Checkpoint for this workflow. Use custom path for your own .safetensors.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Checkpoint</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {MODEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {modelId === 'custom' && (
            <div className="space-y-1.5">
              <Label className="text-xs">Checkpoint path (e.g. models/checkpoints/my.safetensors)</Label>
              <Input
                placeholder="models/checkpoints/..."
                value={customCheckpointPath}
                onChange={(e) => setCustomCheckpointPath(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          )}
          {isVideoWorkflow && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              <Label className="text-xs">Max duration (billing)</Label>
              <Select
                value={String(durationLimit)}
                onValueChange={(v) => handleDurationChange(Number(v))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Duration" />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Video length cap for this generation. Longer clips use more credits.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prompts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Prompts</CardTitle>
          <p className="text-xs text-muted-foreground">Positive and negative text for image or video generation.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Positive prompt</Label>
            <p className="text-[10px] text-muted-foreground mb-1">Example hints (click to append):</p>
            <div className="flex flex-wrap gap-1 mb-1.5">
              {[
                'masterpiece, best quality',
                'cinematic lighting',
                '8k, detailed',
                'portrait, soft light',
                'digital art, vibrant',
                'photorealistic',
              ].map((hint) => (
                <button
                  key={hint}
                  type="button"
                  onClick={() => setPrompt((p) => (p ? `${p}, ${hint}` : hint))}
                  className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {hint}
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Describe the scene, style, subject, lighting…"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[80px] resize-y text-xs"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Negative prompt</Label>
            <Textarea
              placeholder="What to avoid (e.g. blurry, low quality, extra limbs)"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="min-h-[64px] resize-y text-xs"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* KSampler */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">KSampler</CardTitle>
          <p className="text-xs text-muted-foreground">Steps, CFG, sampler, scheduler, denoise.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Steps</Label>
              <div className="flex items-center gap-2">
                <Slider min={1} max={50} step={1} value={steps} onValueChange={setSteps} className="flex-1" />
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{steps[0]}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">CFG scale</Label>
              <div className="flex items-center gap-2">
                <Slider min={1} max={30} step={0.5} value={cfg} onValueChange={setCfg} className="flex-1" />
                <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{cfg[0]}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Denoise</Label>
            <div className="flex items-center gap-2">
              <Slider min={0} max={1} step={0.05} value={denoise} onValueChange={setDenoise} className="flex-1" />
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{denoise[0].toFixed(2)}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Outputs per run</Label>
            <div className="flex items-center gap-2">
              <Slider
                min={1}
                max={outputMax}
                step={1}
                value={[effectiveOutputCount]}
                onValueChange={([value]) => setOutputCount(Math.max(1, Math.min(outputMax, value)))}
                className="flex-1"
              />
              <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">{effectiveOutputCount}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Plan cap: {outputMax} outputs per generation request.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Sampler</Label>
              <Select value={sampler} onValueChange={setSampler}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAMPLERS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Scheduler</Label>
              <Select value={scheduler} onValueChange={setScheduler}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULERS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Seed (leave empty for random)</Label>
            <Input
              type="number"
              placeholder="Random"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* VAE */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">VAE</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={vae} onValueChange={setVae}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VAE_OPTIONS.map((v) => (
                <SelectItem key={v} value={v} className="text-xs">
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Advanced: LoRAs, IP Adapter, ControlNet, Pose */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="loras">
          <AccordionTrigger className="text-sm py-3">LoRAs</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-1">
            {loras.map((row) => (
              <div key={row.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-2">
                <Select value={row.model} onValueChange={(v) => setLoraModel(row.id, v)}>
                  <SelectTrigger className="h-8 flex-1 text-xs">
                    <SelectValue placeholder="LoRA model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">None</SelectItem>
                    <SelectItem value="lora-style" className="text-xs">lora_style_xyz</SelectItem>
                    <SelectItem value="lora-face" className="text-xs">lora_face_xyz</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1 w-24">
                  <Slider
                    min={0}
                    max={1.5}
                    step={0.05}
                    value={[row.strength]}
                    onValueChange={([v]) => setLoraStrength(row.id, v)}
                    className="flex-1"
                  />
                  <span className="text-[10px] w-6 tabular-nums">{row.strength.toFixed(2)}</span>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLora(row.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={addLora}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add LoRA
            </Button>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="ipadapter">
          <AccordionTrigger className="text-sm py-3">IP Adapter</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Enable IP Adapter</Label>
              <Switch checked={ipAdapterEnabled} onCheckedChange={setIpAdapterEnabled} />
            </div>
            {ipAdapterEnabled && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Model</Label>
                  <Select value={ipAdapterModel} onValueChange={setIpAdapterModel}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {IP_ADAPTER_MODELS.map((m) => (
                        <SelectItem key={m} value={m} className="text-xs">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Weight</Label>
                  <div className="flex items-center gap-2">
                    <Slider min={0} max={1.5} step={0.05} value={ipAdapterWeight} onValueChange={setIpAdapterWeight} className="flex-1" />
                    <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{ipAdapterWeight[0].toFixed(2)}</span>
                  </div>
                </div>
                <div className="rounded-md border border-dashed border-border bg-muted/50 p-3 text-center text-[11px] text-muted-foreground">
                  Reference image (drop or pick)
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="controlnet">
          <AccordionTrigger className="text-sm py-3">ControlNet</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Enable ControlNet</Label>
              <Switch checked={controlNetEnabled} onCheckedChange={setControlNetEnabled} />
            </div>
            {controlNetEnabled && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Model</Label>
                  <Select value={controlNetModel} onValueChange={setControlNetModel}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTROLNET_MODELS.map((m) => (
                        <SelectItem key={m} value={m} className="text-xs">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Preprocessor</Label>
                  <Select value={controlNetPreprocessor} onValueChange={setControlNetPreprocessor}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTROLNET_PREPROCESSORS.map((p) => (
                        <SelectItem key={p} value={p} className="text-xs">
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Strength</Label>
                  <div className="flex items-center gap-2">
                    <Slider min={0} max={2} step={0.05} value={controlNetStrength} onValueChange={setControlNetStrength} className="flex-1" />
                    <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{controlNetStrength[0].toFixed(2)}</span>
                  </div>
                </div>
                <div className="rounded-md border border-dashed border-border bg-muted/50 p-3 text-center text-[11px] text-muted-foreground">
                  Control image (pose / canny / depth reference)
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="pose">
          <AccordionTrigger className="text-sm py-3">Pose control</AccordionTrigger>
          <AccordionContent className="space-y-3 pt-1">
            <div className="rounded-md border border-dashed border-border bg-muted/50 p-4 text-center text-[11px] text-muted-foreground">
              Pose reference image (OpenPose / skeleton)
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Pose strength</Label>
              <div className="flex items-center gap-2">
                <Slider min={0} max={2} step={0.05} value={poseStrength} onValueChange={setPoseStrength} className="flex-1" />
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{poseStrength[0].toFixed(2)}</span>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
})
