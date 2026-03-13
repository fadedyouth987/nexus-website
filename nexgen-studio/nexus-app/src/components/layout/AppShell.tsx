'use client'

import { useState } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { WorkspaceProvider } from '@/context/WorkspaceContext'
import { SafeModeProvider } from '@/context/SafeModeContext'
import { GenerationProvider } from '@/context/GenerationContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopBar } from '@/components/layout/TopBar'
import { AssistantChat } from '@/components/intelligence/AssistantChat'
import { Button } from '@/components/ui/button'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [assistantOpen, setAssistantOpen] = useState(false)

  return (
    <WorkspaceProvider>
      <GenerationProvider>
        <SafeModeProvider>
          <div className="relative flex min-h-screen bg-background text-foreground transition-colors duration-500" suppressHydrationWarning>
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(circle at top left, oklch(0.65 0.16 255 / 0.12), transparent 30%), radial-gradient(circle at top right, oklch(0.82 0.09 190 / 0.09), transparent 24%), linear-gradient(180deg, oklch(1 0 0 / 0.02), transparent 46%)',
              }}
            />

            <div className="relative z-10 flex min-h-screen">
              <Sidebar
                isCollapsed={isCollapsed}
                toggleSidebar={() => setIsCollapsed((value) => !value)}
              />
            </div>

            <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden" suppressHydrationWarning>
              <TopBar />

              <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar" suppressHydrationWarning>
                <div className="app-page-shell pb-[calc(var(--section-gap)*1.2)] pt-6 sm:pt-8" suppressHydrationWarning>
                  <div className="animate-in fade-in slide-in-from-bottom-4 space-y-[var(--section-gap)] duration-700 ease-out">
                    {children}
                  </div>
                </div>
              </main>
            </div>

            {assistantOpen ? (
              <div className="app-shell-panel fixed inset-y-4 right-4 z-50 flex w-full max-w-md flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-border/70 px-6 py-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-primary">Assistant</div>
                    <span className="text-lg font-semibold tracking-tight">AI copilot</span>
                  </div>
                  <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setAssistantOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0 p-4">
                  <AssistantChat scope="app" title="" className="h-full min-h-[400px]" />
                </div>
              </div>
            ) : null}

            <Button
              size="icon"
              className="fixed bottom-8 right-8 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-[0_18px_40px_-16px_rgba(55,120,255,0.55)] transition-all hover:scale-105 active:scale-95"
              onClick={() => setAssistantOpen((value) => !value)}
              title="Open assistant"
            >
              <MessageCircle className="h-6 w-6" />
            </Button>
          </div>
        </SafeModeProvider>
      </GenerationProvider>
    </WorkspaceProvider>
  )
}
