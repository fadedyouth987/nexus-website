'use client'

import { useGenerationSettings, LoRASetting } from '@/context/GenerationContext'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { useState } from 'react'

export function LoRATab() {
  const { settings, updateSetting, addLoRA, removeLoRA, updateLoRA } = useGenerationSettings()
  const [newLoRAName, setNewLoRAName] = useState('')
  const [newLoRAPath, setNewLoRAPath] = useState('')

  const handleAddLoRA = () => {
    if (newLoRAName && newLoRAPath) {
      addLoRA(newLoRAName, newLoRAPath)
      setNewLoRAName('')
      setNewLoRAPath('')
    }
  }

  const enabledCount = settings.loras.filter(l => l.enabled).length

  return (
    <div className="space-y-4">
      {/* Add New LoRA */}
      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="space-y-3">
            <Label>Add LoRA</Label>
            <Input
              placeholder="LoRA name (e.g., anime_style)"
              value={newLoRAName}
              onChange={(e) => setNewLoRAName(e.target.value)}
            />
            <Input
              placeholder="Path (e.g., models/loras/anime.safetensors)"
              value={newLoRAPath}
              onChange={(e) => setNewLoRAPath(e.target.value)}
            />
            <Button onClick={handleAddLoRA} className="w-full" size="sm">
              Add LoRA
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* LoRA List */}
      {settings.loras.length > 0 && (
        <div className="space-y-3">
          <Label>
            Active LoRAs ({enabledCount} of {settings.loras.length})
          </Label>
          {settings.loras.map((lora) => (
            <Card key={lora.id}>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={lora.enabled}
                        onCheckedChange={(checked) => 
                          updateLoRA(lora.id, { enabled: checked })
                        }
                      />
                      <span className="font-medium">{lora.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLoRA(lora.id)}
                      className="text-destructive"
                    >
                      Remove
                    </Button>
                  </div>
                  
                  {lora.enabled && (
                    <div className="pl-8 space-y-2">
                      <div className="flex justify-between text-sm">
                        <Label>Strength</Label>
                        <span>{lora.strength.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[lora.strength]}
                        onValueChange={([value]) => 
                          updateLoRA(lora.id, { strength: value })
                        }
                        min={-2}
                        max={2}
                        step={0.01}
                      />
                      <p className="text-xs text-muted-foreground font-mono">
                        {lora.path}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {settings.loras.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No LoRAs added yet. Download LoRAs from Hugging Face or CivitAI
          and add them here.
        </p>
      )}
    </div>
  )
}
