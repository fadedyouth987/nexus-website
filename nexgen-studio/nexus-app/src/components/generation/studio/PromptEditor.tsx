'use client'

import { useGenerationSettings } from '@/context/GenerationContext'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export type PromptStatusKind = 'idle' | 'progress' | 'success' | 'error'

interface PromptEditorProps {
  onGenerate: () => void
  isGenerating: boolean
  isGenerateDisabled: boolean
  statusMessage: string
  statusKind: PromptStatusKind
  orgLoading: boolean
  hasOrganization: boolean
  tokenBalance: number | null
}

export function PromptEditor({
  onGenerate,
  isGenerating,
  isGenerateDisabled,
  statusMessage,
  statusKind,
  orgLoading,
  hasOrganization,
  tokenBalance
}: PromptEditorProps) {
  const { settings, updateSetting } = useGenerationSettings()

  const statusClassName =
    statusKind === 'error'
      ? 'text-destructive'
      : statusKind === 'progress'
        ? 'text-primary animate-pulse'
        : statusKind === 'success'
          ? 'text-primary'
          : 'text-muted-foreground'

  return (
    <div className="app-shell-panel p-5 space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-secondary-foreground font-semibold">Prompt</Label>
        </div>
        <Textarea
          placeholder="Describe the image you want to create (e.g. masterpiece, highres, cyberpunk city...)"
          value={settings.prompt}
          onChange={(e) => updateSetting('prompt', e.target.value)}
          className="min-h-[100px] app-field resize-y font-mono text-sm border-primary/20 focus-visible:border-primary/50"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Negative Prompt</Label>
        </div>
        <Textarea
          placeholder="Elements to exclude (e.g. worst quality, missing fingers...)"
          value={settings.negativePrompt}
          onChange={(e) => updateSetting('negativePrompt', e.target.value)}
          className="min-h-[60px] app-field resize-y font-mono text-xs opacity-90"
        />
      </div>

      <div className="pt-4 flex items-center justify-between border-t border-border/50">
        <div className="min-h-[20px] text-xs text-muted-foreground">
          {statusMessage && <span className={statusClassName}>{statusMessage}</span>}
        </div>
        <Button
          size="lg"
          className="lux-button-primary min-w-[160px]"
          onClick={onGenerate}
          disabled={isGenerateDisabled}
        >
          {isGenerating
            ? 'Generating...'
            : orgLoading
              ? 'Loading...'
              : !hasOrganization
                ? 'Select Org'
                : tokenBalance !== null && tokenBalance <= 0
                  ? 'No Tokens'
                  : 'Generate'}
        </Button>
      </div>
    </div>
  )
}
