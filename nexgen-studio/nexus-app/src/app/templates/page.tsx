import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Templates | Nexus Studio',
  description: 'Fitness, fashion, gamer, CEO, lifestyle. Start from a preset and customize.',
}

const TEMPLATES = [
  { id: 'fitness', name: 'Fitness', description: 'Trainers and wellness creators.' },
  { id: 'fashion', name: 'Fashion', description: 'Style and outfit-focused influencers.' },
  { id: 'gamer', name: 'Gamer', description: 'Gaming and esports personalities.' },
  { id: 'ceo', name: 'CEO', description: 'Thought leaders and exec personas.' },
  { id: 'lifestyle', name: 'Lifestyle', description: 'Day-in-the-life and vlog style.' },
  { id: 'nsfw', name: 'NSFW', description: 'Age-gated. Premium and adult content.' },
]

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-16">
      <div className="mx-auto max-w-4xl space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Templates</h1>
          <p className="text-xl text-muted-foreground">
            Start from a preset. Fitness, fashion, gamer, CEO, lifestyle—then make it yours.
          </p>
        </div>

        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="rounded-xl border border-slate-700 bg-slate-800/30 p-6">
              <h2 className="text-lg font-semibold text-white">{t.name}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t.description}</p>
            </div>
          ))}
        </section>

        <div className="flex justify-center">
          <Button asChild size="lg" className="bg-violet-600 hover:bg-violet-500">
            <Link href="/auth">Use a template</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
