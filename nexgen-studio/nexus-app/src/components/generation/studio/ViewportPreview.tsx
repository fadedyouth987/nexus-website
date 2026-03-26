'use client'

import Link from 'next/link'
import { Loader2, Image as ImageIcon } from 'lucide-react'

interface ViewportPreviewProps {
  isGenerating: boolean
  status: string
  lastJobId: string | null
}

export function ViewportPreview({ isGenerating, status, lastJobId }: ViewportPreviewProps) {
  const shortJobId = lastJobId ? lastJobId.slice(0, 8) : null

  return (
    <div className="app-shell-panel overflow-hidden relative flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/50 backdrop-blur-sm relative z-10">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Viewport</span>

        {lastJobId && !isGenerating && (
          <Link href={`/generations/${lastJobId}`} className="text-xs text-primary hover:underline">
            View Job {shortJobId}...
          </Link>
        )}
      </div>

      <div className="relative aspect-video lg:aspect-square xl:aspect-[16/10] w-full bg-black/50 flex items-center justify-center overflow-hidden">
        {/* If generating, show a futuristic scanning effect */}
        {isGenerating ? (
          <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500 z-10">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <div className="text-sm tracking-widest uppercase text-primary font-mono bg-background/50 px-3 py-1 pb-1.5 rounded-full border border-primary/20 backdrop-blur-md">
              {status || 'Processing...'}
            </div>
          </div>
        ) : lastJobId ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground z-10 animate-in fade-in zoom-in-95 duration-500">
            <div className="p-4 rounded-full bg-primary/10 border border-primary/20 shadow-[0_0_30px_rgba(55,120,255,0.15)]">
              <ImageIcon className="w-8 h-8 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground/90">Latest Generation</p>
            <p className="text-xs text-center max-w-[280px]">
              Job <span className="font-mono text-primary bg-primary/10 px-1 py-0.5 rounded">{shortJobId}</span>.
              Click the link above to view status.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground/40 z-10">
            <ImageIcon className="w-12 h-12 stroke-[1]" />
            <p className="text-sm uppercase tracking-widest font-semibold">Ready for payload</p>
          </div>
        )}

        {/* Depth Grid background */}
        <div className="absolute inset-0 opacity-[0.15] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_10%,transparent_100%)]" />

        {/* Minimal scanning line effect during generation */}
        {isGenerating && (
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="w-full h-[2px] bg-primary blur-[2px] animate-[lux-scan_2.5s_ease-in-out_infinite]" />
          </div>
        )}
      </div>
    </div>
  )
}
