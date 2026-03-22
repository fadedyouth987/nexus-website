import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata = {
  title: 'Learn | Nexus Studio',
  description:
    'Explicit beta setup: live OAuth platforms, staged networks, automation pipeline, NSFW gating, and how static hosting keeps marketing fast.',
}

export default function LearnPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentation & Setup"
        description="Step-by-step truth: what ships in beta, which social connectors are live vs stubbed, and how generation latency differs from page load speed."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>1) Initial setup</CardTitle>
            <CardDescription>Complete these steps first.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>1. Create your creator profile in <Link className="underline" href="/creators/create">Creators</Link>.</p>
            <p>2. Configure look, niche, and prompt direction in <Link className="underline" href="/studio">Studio</Link>.</p>
            <p>3. Build strategy and calendar in <Link className="underline" href="/automation/planner">Content planner</Link>.</p>
            <p>4. Queue, review, and refine posts inside <Link className="underline" href="/automation/planner">Content planner</Link>.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2) Age & NSFW gating</CardTitle>
            <CardDescription>NSFW is hard-gated to 18+ verified users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Complete Terms + 18+ check + OTP in <Link className="underline" href="/settings/verification">Age &amp; NSFW</Link>.</p>
            <p>NSFW content stays gated until verification is complete.</p>
            <p>SFW content remains available without NSFW mode.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>3) Social platform publishing matrix</CardTitle>
            <CardDescription>Current integration status and NSFW policy.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  <th className="px-3 py-2 text-left">Platform</th>
                  <th className="px-3 py-2 text-left">Integration</th>
                  <th className="px-3 py-2 text-left">SFW</th>
                  <th className="px-3 py-2 text-left">NSFW</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Instagram', 'Live', 'Yes', 'No'],
                  ['Facebook', 'Live', 'Yes', 'No'],
                  ['TikTok', 'Stub', 'Yes', 'No'],
                  ['X (Twitter)', 'Stub', 'Yes', 'Yes'],
                  ['YouTube', 'Stub', 'Yes', 'No'],
                  ['LinkedIn', 'Stub', 'Yes', 'No'],
                  ['Pinterest', 'Stub', 'Yes', 'No'],
                  ['Reddit', 'Stub', 'Yes', 'Yes'],
                  ['Threads', 'Planned', 'Yes', 'No'],
                  ['Snapchat', 'Planned', 'Yes', 'No'],
                  ['OnlyFans', 'Planned', 'Yes', 'Yes'],
                  ['Fansly', 'Planned', 'Yes', 'Yes'],
                ].map((row) => (
                  <tr key={row[0]} className="border-t border-border">
                    <td className="px-3 py-2">{row[0]}</td>
                    <td className="px-3 py-2">{row[1]}</td>
                    <td className="px-3 py-2">{row[2]}</td>
                    <td className="px-3 py-2">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4) Automation pipeline</CardTitle>
            <CardDescription>How end-to-end automation flows in Nexus Studio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Factory / Planner {'->'} Content queue {'->'} Dispatch due posts {'->'} Publish worker {'->'} Retry worker {'->'} Analytics optimization.</p>
            <p>Use <Link className="underline" href="/automation/factory">AI Influencer Factory</Link> for one-shot setup.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Need help?</CardTitle>
            <CardDescription>Support and implementation guidance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Open <Link className="underline" href="/contact">Contact Support</Link> and submit a ticket with severity.</p>
            <p>For billing/organization issues, use Settings {'->'} Billing/Organization/Team.</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>5) Speed: marketing vs in-app work</CardTitle>
            <CardDescription>Separate perceived UI speed from GPU and queue time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              <strong className="text-foreground">Marketing & shell.</strong> Public pages are exported as static HTML and assets (Next.js{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">output: &apos;export&apos;</code>
              ), so first paint is bounded by CDN latency and bundle size—not by ComfyUI.
            </p>
            <p>
              <strong className="text-foreground">Generation.</strong> Still and video jobs enqueue to workers and GPUs you operate; wall-clock
              time includes model load, step count, and concurrency. Watch worker health inside the dashboard when jobs stall.
            </p>
            <p>
              <strong className="text-foreground">Publishing.</strong> OAuth round-trips and platform rate limits apply after Nexus hands off
              media; only Instagram and Facebook connectors are live today—everything else in the matrix is stubbed or planned until wired.
            </p>
            <p>
              For analytics scope (read-only today vs experiment roadmap), read{' '}
              <Link className="underline" href="/analytics">
                Analytics
              </Link>{' '}
              after visiting <Link className="underline" href="/intelligence">Intelligence</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
