'use client'

import { useGenerationSettings } from '@/context/GenerationContext'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'

export function AdvancedTab() {
  const { settings, updateSetting } = useGenerationSettings()

  return (
    <div className="space-y-4">
      {/* Clip Skip */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <Label>Clip Skip: {settings.clipSkip ?? 1}</Label>
        </div>
        <Slider
          value={[settings.clipSkip ?? 1]}
          onValueChange={([value]) => updateSetting('clipSkip', value)}
          min={1}
          max={12}
          step={1}
        />
        <p className="text-xs text-muted-foreground">
          Higher = less attention to prompt details
        </p>
      </div>
      
      {/* Highres Fix */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Highres Fix</Label>
          <p className="text-xs text-muted-foreground">
            Generate at 2x size, then downscale
          </p>
        </div>
        <Switch
          checked={settings.highresFix ?? false}
          onCheckedChange={(checked) => updateSetting('highresFix', checked)}
        />
      </div>
      
      {settings.highresFix && (
        <div className="space-y-2 pl-4 border-l-2 border-muted">
          <Label>Upscale Factor: {settings.hrScale ?? 2}</Label>
          <Slider
            value={[settings.hrScale ?? 2]}
            onValueChange={([value]) => updateSetting('hrScale', value)}
            min={1.5}
            max={4}
            step={0.5}
          />
          
          <Label>Hires Steps: {settings.hrSteps ?? 20}</Label>
          <Slider
            value={[settings.hrSteps ?? 20]}
            onValueChange={([value]) => updateSetting('hrSteps', value)}
            min={0}
            max={50}
            step={1}
          />
          
          <Label>Denoise: {settings.hrDenoise ?? 0.3}</Label>
          <Slider
            value={[settings.hrDenoise ?? 0.3]}
            onValueChange={([value]) => updateSetting('hrDenoise', value)}
            min={0}
            max={1}
            step={0.01}
          />
        </div>
      )}
      
      {/* Save to Gallery */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Save to Gallery</Label>
          <p className="text-xs text-muted-foreground">
            Automatically save generations
          </p>
        </div>
        <Switch
          checked={settings.saveToGallery ?? true}
          onCheckedChange={(checked) => updateSetting('saveToGallery', checked)}
        />
      </div>
      
      {/* Generate with random seed */}
      <div className="flex items-center justify-between">
        <div>
          <Label>Random Seed Each Gen</Label>
          <p className="text-xs text-muted-foreground">
            Reset seed to -1 after each generation
          </p>
        </div>
        <Switch
          checked={settings.randomSeedAfterGen ?? false}
          onCheckedChange={(checked) => updateSetting('randomSeedAfterGen', checked)}
        />
      </div>
    </div>
  )
}
