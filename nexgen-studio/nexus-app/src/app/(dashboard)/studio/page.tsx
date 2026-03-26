'use client'

import { OrganizationSelector } from '@/components/dashboard/OrganizationSelector'
import { GenerationProvider } from '@/context/GenerationContext'
import { StudioWorkspaceView } from '@/components/generation/studio/StudioWorkspaceView'

export default function StudioPage() {
  return (
    <div className="flex w-full flex-col h-full bg-background dark:bg-[#0a0a0c]">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 shrink-0 z-10">
          <div className="app-shell-panel-muted relative overflow-hidden rounded-2xl border-b-0 bg-background/30 p-4 shadow-none backdrop-blur-md">
            <div className="pointer-events-none absolute left-0 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-primary/10 blur-[40px]" />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="h-8 w-1.5 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" />
                <div>
                  <h1 className="text-xl font-semibold tracking-tight text-foreground">
                    Studio Generation
                  </h1>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-primary/80">
                    Control Center
                  </p>
                </div>
              </div>

              <OrganizationSelector />
            </div>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <GenerationProvider>
            <StudioWorkspaceView />
          </GenerationProvider>
        </div>
      </div>
    </div>
  )
}
