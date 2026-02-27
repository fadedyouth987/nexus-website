'use client'

import { useGenerationSettings } from '@/context/GenerationContext'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const controlnetModels = [
  { value: 'none', label: 'None' },
  { value: 'openpose', label: 'OpenPose' },
  { value: 'canny', label: 'Canny' },
  { value: 'depth', label: 'Depth' },
  { value: 'normal', label: 'Normal Map' },
  { value: 'seg', label: 'Segmentation' },
  { value: 'lineart', label: 'Lineart' },
  { value: 'softedge', label: 'SoftEdge' },
  { value: 'mlsd', label: 'MLSD (Lines)' },
  { value: 'tile', label: 'Tile/Blur' },
]

const preprocessors: Record<string, string[]> = {
  none: ['none'],
  openpose: ['openpose', 'openpose_face', 'openpose_hand'],
  canny: ['canny'],
  depth: ['depth_midas', 'depth_leres'],
  normal: ['normal_bae'],
  seg: ['segmentation'],
  lineart: ['lineart_anime', 'lineart_coarse'],
  softedge: ['softedge_pidinet', 'softedge_.safe'],
  mlsd: ['mlsd'],
  tile: ['tile_resample'],
}

export function ControlNetTab() {
  const { settings, updateSetting } = useGenerationSettings()
  
  const availablePreprocessors = preprocessors[settings.controlnetModel] || ['none']

  return (
    <div className="space-y-4">
      {/* Enable ControlNet */}
      <div className="flex items-center justify-between">
        <Label>Enable ControlNet</Label>
        <Switch
          checked={settings.controlnetEnabled}
          onCheckedChange={(checked) => updateSetting('controlnetEnabled', checked)}
        />
      </div>
      
      {settings.controlnetEnabled && (
        <>
          {/* Model */}
          <div className="space-y-2">
            <Label>ControlNet Model</Label>
            <Select
              value={settings.controlnetModel}
              onValueChange={(value) => updateSetting('controlnetModel', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {controlnetModels.map((model) => (
                  <SelectItem key={model.value} value={model.value}>
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Preprocessor */}
          <div className="space-y-2">
            <Label>Preprocessor</Label>
            <Select
              value={settings.controlnetPreprocessor}
              onValueChange={(value) => updateSetting('controlnetPreprocessor', value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availablePreprocessors.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Strength */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Control Strength: {settings.controlnetStrength.toFixed(2)}</Label>
            </div>
            <Slider
              value={[settings.controlnetStrength]}
              onValueChange={([value]) => updateSetting('controlnetStrength', value)}
              min={0}
              max={2}
              step={0.01}
            />
            <p className="text-xs text-muted-foreground">
              Lower = more creative freedom, Higher = follows control image more
            </p>
          </div>
        </>
      )}
      
      {!settings.controlnetEnabled && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Enable ControlNet to use pose, depth, or edge guidance
        </p>
      )}
    </div>
  )
}
