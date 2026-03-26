'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useGenerationSettings } from '@/context/GenerationContext'
import { LoRATab } from './LoRATab'
import { ModelTab } from './ModelTab'
import { SamplerTab } from './SamplerTab'
import { ControlNetTab } from './ControlNetTab'
import { AdvancedTab } from './AdvancedTab'

interface GenerationPanelProps {
  planTier: string
  batchLimit: number
  tokenBalance: number | null
}

export function GenerationPanel({ planTier, batchLimit, tokenBalance }: GenerationPanelProps) {
  const { resetSettings, exportSettings } = useGenerationSettings()

  return (
    <div className="app-shell-panel flex flex-col h-full rounded-[var(--radius-panel)] border border-border/60 bg-[linear-gradient(160deg,var(--surface-elevated),var(--surface-muted)_120%)] shadow-xl relative backdrop-blur-2xl">
      <div className="flex flex-col gap-2 p-5 border-b border-border/50">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">Controls</h2>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={resetSettings} className="h-7 text-xs px-2 hover:bg-muted/50">
              Reset
            </Button>
            <Button variant="ghost" size="sm" onClick={() => console.log(exportSettings())} className="h-7 text-xs px-2 hover:bg-muted/50">
              Export
            </Button>
          </div>
        </div>
        <div className="flex justify-between items-center bg-background/50 rounded-md px-3 py-2 border border-border/40">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Plan: <span className="font-semibold text-foreground">{planTier}</span></p>
          {tokenBalance !== null && (
            <p className="text-[11px] font-semibold text-primary uppercase tracking-wider">
              {tokenBalance.toLocaleString()} Tokens
            </p>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 pt-4">
        <Tabs defaultValue="model" className="w-full">
          <TabsList className="grid w-full grid-cols-5 h-9 mb-6 bg-muted/40 p-1">
            <TabsTrigger value="model" className="text-xs">Model</TabsTrigger>
            <TabsTrigger value="sampler" className="text-xs">Sampler</TabsTrigger>
            <TabsTrigger value="lora" className="text-xs">LoRA</TabsTrigger>
            <TabsTrigger value="controlnet" className="text-xs">CtrlNet</TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs">Adv.</TabsTrigger>
          </TabsList>
          
          <TabsContent value="model" className="mt-0 outline-none animate-in fade-in-50 slide-in-from-bottom-1 duration-300">
            <ModelTab />
          </TabsContent>
          
          <TabsContent value="sampler" className="mt-0 outline-none animate-in fade-in-50 slide-in-from-bottom-1 duration-300">
            <SamplerTab maxBatchSize={batchLimit} planLabel={planTier} />
          </TabsContent>
          
          <TabsContent value="lora" className="mt-0 outline-none animate-in fade-in-50 slide-in-from-bottom-1 duration-300">
            <LoRATab />
          </TabsContent>
          
          <TabsContent value="controlnet" className="mt-0 outline-none animate-in fade-in-50 slide-in-from-bottom-1 duration-300">
            <ControlNetTab />
          </TabsContent>
          
          <TabsContent value="advanced" className="mt-0 outline-none animate-in fade-in-50 slide-in-from-bottom-1 duration-300">
            <AdvancedTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
