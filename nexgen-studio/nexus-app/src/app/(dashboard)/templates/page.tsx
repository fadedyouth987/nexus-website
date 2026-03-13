'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AppHero } from '@/components/layout/AppHero'
import { Loader2, ImageIcon, Video, Search, Sparkles } from 'lucide-react'
import apiFetch from '@/lib/core/api'

type WorkflowTemplate = {
  id: string
  slug: string
  name: string
  type: 'IMAGE' | 'VIDEO'
  description?: string
  base_cost_credits?: number | null
  created_at?: string
}

const PERSONA_PRESETS = [
  { id: 'fitness', name: 'Fitness Creator', description: 'Trainers and wellness influencers with workout and nutrition content.', niche: 'fitness' },
  { id: 'fashion', name: 'Fashion Influencer', description: 'Style, outfit, and trend-focused content creators.', niche: 'fashion' },
  { id: 'gamer', name: 'Gaming Persona', description: 'Gaming highlights, reviews, and esports personality content.', niche: 'gaming' },
  { id: 'ceo', name: 'Thought Leader', description: 'Executive presence, business insights, and leadership content.', niche: 'business' },
  { id: 'lifestyle', name: 'Lifestyle Vlogger', description: 'Day-in-the-life, travel, and aspirational lifestyle content.', niche: 'lifestyle' },
  { id: 'nsfw', name: 'Premium Creator', description: 'Age-gated premium and exclusive content. Requires verification.', niche: 'premium' },
]

export default function TemplatesPage() {
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await apiFetch('/workflow-templates')
        if (!res.ok || cancelled) return
        const payload = (await res.json()) as { items?: WorkflowTemplate[] } | WorkflowTemplate[]
        const items = Array.isArray(payload) ? payload : payload?.items ?? []
        if (!cancelled) setWorkflows(items)
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false) }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  const filteredWorkflows = workflows.filter((w) =>
    !filter || w.name.toLowerCase().includes(filter.toLowerCase()) || w.type.toLowerCase().includes(filter.toLowerCase())
  )

  const GROUP_ORDER = ['SD 1.0', 'SD 1.5', 'SDXL', 'Video', 'Utilities', 'General']

  const getGroup = (wf: WorkflowTemplate) => {
    const name = wf.name.toLowerCase()
    const type = wf.type.toLowerCase()
    
    if (type === 'video') return 'Video'
    if (name.includes('upscale')) return 'Utilities'
    if (name.includes('sd 1.5') || name.includes('sd1.5') || name.includes('sd15')) return 'SD 1.5'
    if (name.includes('sdxl') || name.includes('sd xl')) return 'SDXL'
    if (name.includes('sd 1.0') || name.includes('sd1.0') || name.includes('sd 1') || name.includes('sd1')) return 'SD 1.0'
    return 'General'
  }

  const groupedWorkflows = filteredWorkflows.reduce((acc, wf) => {
    const g = getGroup(wf)
    if (!acc[g]) acc[g] = []
    acc[g].push(wf)
    return acc
  }, {} as Record<string, typeof filteredWorkflows>)

  // Sort within groups: SFW first, then NSFW. Then alphabetically.
  Object.values(groupedWorkflows).forEach(group => {
    group.sort((a, b) => {
      const aNsfw = a.name.toLowerCase().includes('nsfw')
      const bNsfw = b.name.toLowerCase().includes('nsfw')
      if (aNsfw && !bNsfw) return 1
      if (!aNsfw && bNsfw) return -1
      return a.name.localeCompare(b.name)
    })
  })

  const filteredPresets = PERSONA_PRESETS.filter((p) =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase()) || p.niche.includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-[var(--section-gap)]">
      <AppHero
        eyebrow="Templates"
        title="Template Browser"
        description="Browse workflow templates for image and video generation, or start from a persona preset to create a new AI influencer."
        actions={
          <>
            <Button asChild size="lg">
              <Link href="/studio">Open Studio</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/automation/factory">AI Factory</Link>
            </Button>
          </>
        }
        metrics={[
          { label: 'Workflow Templates', value: workflows.length },
          { label: 'Persona Presets', value: PERSONA_PRESETS.length },
        ]}
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filter templates..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-10"
        />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4">Workflow Templates</h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredWorkflows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {workflows.length === 0
                ? 'No workflow templates found. Add templates in Supabase workflow_templates table.'
                : 'No templates match your filter.'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {GROUP_ORDER.map(group => {
              const wfs = groupedWorkflows[group]
              if (!wfs || wfs.length === 0) return null
              return (
                <div key={group} className="space-y-4">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
                    {group}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {wfs.map(wf => (
                      <Card key={wf.id} className="flex flex-col">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <CardTitle className="text-base">{wf.name}</CardTitle>
                              <CardDescription className="mt-1">{wf.description || wf.slug}</CardDescription>
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              wf.type === 'IMAGE' ? 'bg-blue-500/10 text-blue-600' : 'bg-purple-500/10 text-purple-600'
                            }`}>
                              {wf.type === 'IMAGE' ? <ImageIcon className="h-3 w-3" /> : <Video className="h-3 w-3" />}
                              {wf.type}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="mt-auto space-y-3">
                          {wf.base_cost_credits != null && (
                            <p className="text-xs text-muted-foreground">~{wf.base_cost_credits} credits per run</p>
                          )}
                          <Button size="sm" className="w-full" asChild>
                            <Link href={`/studio?template=${wf.id}`}>
                              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                              Use this template
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">Persona Presets</h2>
        <p className="text-sm text-muted-foreground mb-4">Quick-start with a persona archetype. These feed into the AI Factory to create a full influencer profile.</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredPresets.map((preset) => (
            <Card key={preset.id}>
              <CardHeader>
                <CardTitle className="text-base">{preset.name}</CardTitle>
                <CardDescription>{preset.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" className="w-full" asChild>
                  <Link href={`/automation/factory?niche=${preset.niche}`}>
                    Create with Factory
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
