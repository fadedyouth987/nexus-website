import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Influencer Creation | NexGen Studio',
  description: 'Photoreal generation, talking-head video, style and character presets. See how identity consistency works.',
}

export default function CreatePage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl space-y-12">
        <div className="space-y-4 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Influencer Creation</h1>
          <p className="text-xl text-muted-foreground">
            The magic: photoreal generation, talking-head video, and identity that stays consistent everywhere.
          </p>
        </div>

        <section className="grid gap-8 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
            <h2 className="text-lg font-semibold text-white">Photoreal examples</h2>
            <p className="mt-2 text-sm text-muted-foreground">Current beta surface for creator setup and generation direction.</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
            <h2 className="text-lg font-semibold text-white">Talking-head video</h2>
            <p className="mt-2 text-sm text-muted-foreground">Video workflows are available in the studio stack, with quality depending on the selected template and model.</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
            <h2 className="text-lg font-semibold text-white">Style & character presets</h2>
            <p className="mt-2 text-sm text-muted-foreground">Use creator setup, prompt presets, and workflow templates to keep direction consistent.</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
            <h2 className="text-lg font-semibold text-white">Beta workflow</h2>
            <p className="mt-2 text-sm text-muted-foreground">This page explains the flow; the working creation surface is the Studio and creator setup routes.</p>
          </div>
        </section>

        <section className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center">
          <h2 className="text-xl font-semibold text-white">Identity consistency (Series Engine)</h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            One character, one voice, one look across every platform and piece of content. Our engine keeps your influencer recognizable and on-brand.
          </p>
        </section>

        <div className="flex justify-center gap-4">
          <Button asChild size="lg" variant="outline">
            <Link href="/create/influencer">Create with ComfyUI (lock identity)</Link>
          </Button>
          <Button asChild size="lg" className="bg-violet-600 hover:bg-violet-500">
            <Link href="/auth">Sign in to start</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
