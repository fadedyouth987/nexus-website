'use client'

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
import apiFetch from '@/lib/api'
import { useState } from 'react'

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

export function GenerationPanel() {
  const { settings, updateSetting, resetSettings, exportSettings } = useGenerationSettings()
  const [isGenerating, setIsGenerating] = useState(false)
  const [status, setStatus] = useState('')

  const handleGenerate = async () => {
    setIsGenerating(true)
    setStatus('Initializing...')
    
    try {
      // Build the payload for ComfyUI
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
        batch_size: settings.batchSize,
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
        throw new Error('Generation failed')
      }
      
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
            <SamplerTab />
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
        <div className="mt-6 pt-4 border-t">
          <Button 
            className="w-full" 
            size="lg"
            onClick={handleGenerate}
            disabled={isGenerating}
          >
            {isGenerating ? status || 'Generating...' : 'Generate Image'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
