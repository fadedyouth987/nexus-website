import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Blog | Nexus Studio',
  description: 'AI influencer, AI content automation, AI marketing. Tips and updates.',
}

export default function BlogPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-16">
      <div className="mx-auto max-w-4xl space-y-12">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Blog</h1>
          <p className="text-xl text-muted-foreground">
            AI influencer, content automation, and marketing. SEO and updates.
          </p>
        </div>

        <section className="rounded-xl border border-slate-700 bg-slate-800/30 p-8 text-center">
          <p className="text-muted-foreground">Blog posts and SEO content go here.</p>
        </section>

        <div className="flex justify-center">
          <Button asChild size="lg" variant="outline">
            <Link href="/landing">Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
