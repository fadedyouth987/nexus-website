'use client'

import { useGenerationSettings } from '@/context/GenerationContext'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const samplers = [
  { value: 'euler', label: 'Euler' },
  { value: 'euler_a', label: 'Euler a' },
  { value: 'heun', label: 'Heun' },
  { value: 'dpm2', label: 'DPM2' },
  { value: 'dpm2_a', label: 'DPM2 a' },
  { value: 'dpmpp_2s_a', label: 'DPM++ 2S a' },
  { value: 'dpmpp_sde', label: 'DPM++ SDE' },
  { value: 'dpmpp_2m', label: 'DPM++ 2M' },
  { value: 'dpmpp_2m_sde', label: 'DPM++ 2M SDE' },
  { value: 'lcm', label: 'LCM' },
  { value: 'ddim', label: 'DDIM' },
  { value: 'uni_pc', label: 'UniPC' },
]

const schedulers = [
  { value: 'normal', label: 'Normal' },
  { value: 'karras', label: 'Karras' },
  { value: 'exponential', label: 'Exponential' },
  { value: 'sgm_uniform', label: 'SGM Uniform' },
  { value: 'simple', label: 'Simple' },
  { value: 'ddim_uniform', label: 'DDIM Uniform' },
]

type SamplerTabProps = {
  maxBatchSize?: number
  planLabel?: string
}

export function SamplerTab({ maxBatchSize = 4, planLabel = '' }: SamplerTabProps) {
  const { settings, updateSetting } = useGenerationSettings()
  const batchMax = Math.max(1, Math.floor(maxBatchSize))
  const effectiveBatchSize = Math.max(1, Math.min(batchMax, settings.batchSize))

  const randomizeSeed = () => {
    updateSetting('seed', Math.floor(Math.random() * 4294967296))
  }

  return (
    <div className="space-y-4">
      {/* Steps */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Steps: {settings.steps}</Label>
        </div>
        <Slider
          value={[settings.steps]}
          onValueChange={([value]) => updateSetting('steps', value)}
          min={1}
          max={100}
          step={1}
        />
      </div>
      
      {/* CFG Scale */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>CFG Scale: {settings.cfg}</Label>
        </div>
        <Slider
          value={[settings.cfg]}
          onValueChange={([value]) => updateSetting('cfg', value)}
          min={1}
          max={20}
          step={0.5}
        />
      </div>
      
      {/* Sampler */}
      <div className="space-y-2">
        <Label>Sampler</Label>
        <Select
          value={settings.sampler}
          onValueChange={(value) => updateSetting('sampler', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {samplers.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Scheduler */}
      <div className="space-y-2">
        <Label>Scheduler</Label>
        <Select
          value={settings.scheduler}
          onValueChange={(value) => updateSetting('scheduler', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {schedulers.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Seed */}
      <div className="space-y-2">
        <Label>Seed</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            value={settings.seed}
            onChange={(e) => updateSetting('seed', parseInt(e.target.value) || -1)}
            className="flex-1"
          />
          <Button variant="outline" size="icon" onClick={randomizeSeed} title="Random">
            🎲
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          -1 for random seed
        </p>
      </div>
      
      {/* Denoise */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Denoise: {settings.denoise.toFixed(2)}</Label>
        </div>
        <Slider
          value={[settings.denoise]}
          onValueChange={([value]) => updateSetting('denoise', value)}
          min={0}
          max={1}
          step={0.01}
        />
      </div>
      
      {/* Batch Size */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Batch Size: {effectiveBatchSize}</Label>
        </div>
        <Slider
          value={[effectiveBatchSize]}
          onValueChange={([value]) =>
            updateSetting('batchSize', Math.max(1, Math.min(batchMax, value)))
          }
          min={1}
          max={batchMax}
          step={1}
        />
        <p className="text-xs text-muted-foreground">
          Plan cap: {batchMax} outputs per request{planLabel ? ` (${planLabel})` : ''}.
        </p>
      </div>
    </div>
  )
}
