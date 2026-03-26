import Link from 'next/link'
import { Button } from '@/components/ui/button'

type PageProps = { params: Promise<{ id: string }> }

export default async function GenerationStatusPage({ params }: PageProps) {
  const { id } = await params

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Generations</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Job status</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Job ID: <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{id}</code>
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Progress updates can be streamed over WebSocket when <code className="text-foreground">NEXT_PUBLIC_WS_URL</code>{' '}
        and the websocket gateway are running.
      </p>
      <Button asChild className="mt-6" variant="outline">
        <Link href="/studio">Back to studio</Link>
      </Button>
    </div>
  )
}
