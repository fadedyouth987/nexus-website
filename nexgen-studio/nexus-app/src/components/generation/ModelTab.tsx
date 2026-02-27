'use client'

import { useGenerationSettings } from '@/context/GenerationContext'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const checkpoints = [
  { value: 'sd15', label: 'Stable Diffusion 1.5' },
  { value: 'sd21', label: 'Stable Diffusion 2.1' },
  { value: 'sdxl', label: 'SDXL 1.0' },
  { value: 'pony', label: 'Pony Diffusion' },
  { value: 'realistic', label: 'Realistic Vision' },
  { value: 'anime', label: 'Anime' },
  { value: 'dreamshaper', label: 'DreamShaper' },
  { value: 'revAnimated', label: 'Rev Animated' },
]

const vaeOptions = [
  { value: 'Auto', label: 'Auto' },
  { value: 'vae840000', label: 'VAE 840000' },
  { value: 'vaeft', label: 'VAE FT-MSE' },
  { value: 'kl-f8', label: 'KL-F8' },
  { value: 'orangemix', label: 'OrangeMix' },
]

export function ModelTab() {
  const { settings, updateSetting } = useGenerationSettings()

  return (
    <div className="space-y-4">
      {/* Checkpoint */}
      <div className="space-y-2">
        <Label>Checkpoint Model</Label>
        <Select
          value={settings.checkpoint}
          onValueChange={(value) => updateSetting('checkpoint', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select checkpoint" />
          </SelectTrigger>
          <SelectContent>
            {checkpoints.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Place custom models in: models/checkpoints/
        </p>
      </div>
      
      {/* VAE */}
      <div className="space-y-2">
        <Label>VAE</Label>
        <Select
          value={settings.vae}
          onValueChange={(value) => updateSetting('vae', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vaeOptions.map((vae) => (
              <SelectItem key={vae.value} value={vae.value}>
                {vae.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Width: {settings.width}</Label>
          <Select
            value={settings.width.toString()}
            onValueChange={(value) => updateSetting('width', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[256, 512, 768, 1024, 1280, 1536].map((w) => (
                <SelectItem key={w} value={w.toString()}>
                  {w}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label>Height: {settings.height}</Label>
          <Select
            value={settings.height.toString()}
            onValueChange={(value) => updateSetting('height', parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[256, 512, 768, 1024, 1280, 1536].map((h) => (
                <SelectItem key={h} value={h.toString()}>
                  {h}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
