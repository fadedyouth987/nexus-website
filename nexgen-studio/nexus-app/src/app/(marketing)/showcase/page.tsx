'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Sparkles } from 'lucide-react'

export default function ShowcasePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Showcase"
        description="Featured and public creations from the community."
      />
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-16 px-4 text-center">
        <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground">Coming soon</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-sm">
          Explore featured images and videos from creators. Public showcase and discover prompts will be available here.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href="/gallery">View your Gallery</Link>
        </Button>
      </div>
    </div>
  )
}
