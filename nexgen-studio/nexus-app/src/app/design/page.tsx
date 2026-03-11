'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Brush, LayoutTemplate, Palette, Sparkles, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

export default function DesignPage() {
  const [brandTone, setBrandTone] = useState('Confident, witty, premium')
  const [captionStyle, setCaptionStyle] = useState('Short hooks, 1 CTA, emoji-light')
  const [selectedPreset, setSelectedPreset] = useState('viral-shortform')
  const [selectedFormats, setSelectedFormats] = useState<string[]>(['9:16', '1:1'])
  const [checklist, setChecklist] = useState({
    hook: true,
    cta: true,
    policy: true,
    brand: false,
  })

  function toggleFormat(value: string) {
    setSelectedFormats((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    )
  }

  function toggleChecklist(key: keyof typeof checklist) {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Design"
        description="Build consistent visual systems for creators, not one-off assets."
        breadcrumb={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Studio', href: '/studio' }, { label: 'Design' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/studio" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Studio
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/edit">Open editor</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Palette className="h-4 w-4" />
              Brand system
            </CardTitle>
            <CardDescription>Set reusable style rules that generation and editing can follow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Voice and tone</label>
                <Input
                  value={brandTone}
                  onChange={(e) => setBrandTone(e.target.value)}
                  placeholder="Confident, playful, premium..."
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Caption style</label>
                <Input
                  value={captionStyle}
                  onChange={(e) => setCaptionStyle(e.target.value)}
                  placeholder="Short hook + CTA..."
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Primary palette</label>
                <div className="flex gap-2">
                  {['#0B0B0F', '#7C3AED', '#E879F9', '#F4F4F5'].map((color) => (
                    <button
                      key={color}
                      type="button"
                      title={color}
                      className="h-8 w-8 rounded-md border border-border"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Output formats</label>
                <div className="flex flex-wrap gap-2">
                  {['9:16', '1:1', '4:5', '16:9'].map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => toggleFormat(format)}
                      className={`rounded-md border px-2 py-1 text-xs ${
                        selectedFormats.includes(format)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground'
                      }`}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" />
              Export checklist
            </CardTitle>
            <CardDescription>Quick QA before sending content to scheduler.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={checklist.hook} onChange={() => toggleChecklist('hook')} />
              Hook is strong in first line
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={checklist.cta} onChange={() => toggleChecklist('cta')} />
              CTA matches campaign goal
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={checklist.policy} onChange={() => toggleChecklist('policy')} />
              Platform policy check passed
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={checklist.brand} onChange={() => toggleChecklist('brand')} />
              Brand tone consistency check
            </label>
            <Button className="mt-2 w-full" variant="outline" asChild>
              <Link href="/automation/scheduler">Schedule approved assets</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutTemplate className="h-4 w-4" />
              Template packs
            </CardTitle>
            <CardDescription>Use packs tuned for growth stages and monetization goals.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div className="rounded-md border border-border p-2">
              <p className="font-medium text-foreground">Viral shortform</p>
              <p className="text-xs">Hook-first visuals, minimal copy, rapid cadence.</p>
            </div>
            <div className="rounded-md border border-border p-2">
              <p className="font-medium text-foreground">Luxury lifestyle</p>
              <p className="text-xs">Premium tone, cinematic framing, soft-sell CTA.</p>
            </div>
            <div className="rounded-md border border-border p-2">
              <p className="font-medium text-foreground">Conversion funnel</p>
              <p className="text-xs">Teaser -&gt; proof -&gt; value -&gt; subscription prompt.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brush className="h-4 w-4" />
              Active preset
            </CardTitle>
            <CardDescription>Choose the design preset for the next generation batch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="viral-shortform">Viral shortform</option>
              <option value="luxury-lifestyle">Luxury lifestyle</option>
              <option value="conversion-funnel">Conversion funnel</option>
            </select>
            <Button className="w-full" asChild>
              <Link href="/studio">Generate with this preset</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              Production flow
            </CardTitle>
            <CardDescription>Move fast from concept to distribution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/studio">1. Generate assets in Studio</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/edit">2. Refine in editor</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/gallery">3. Review in gallery</Link>
            </Button>
            <Button variant="outline" className="w-full justify-start" asChild>
              <Link href="/automation/scheduler">4. Queue + schedule</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
