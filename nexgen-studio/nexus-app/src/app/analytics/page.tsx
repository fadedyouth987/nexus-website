import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata = {
  title: 'Analytics | Nexus Studio',
  description:
    'What analytics does today: read-only portfolio metrics and Intelligence. Planned: charts, engagement depth, and A/B experiment management.',
}

const analyticsBlocks = [
  {
    title: 'Growth charts',
    body: 'Followers, reach, and trend lines over time.',
  },
  {
    title: 'Engagement metrics',
    body: 'Likes, comments, shares, and sentiment.',
  },
  {
    title: 'Content performance',
    body: 'Which posts and formats perform best.',
  },
  {
    title: 'Series & episode analytics',
    body: 'Track series and episodes in one place.',
  },
]

export default function AnalyticsPage() {
  return (
    <div className="space-y-[var(--section-gap)]">
      <PageHeader
        title="Analytics"
        description="Current beta: portfolio-style metrics inside Intelligence when your workspace has data. This page lists the roadmap for charts, funnels, and true A/B runs."
        breadcrumb={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Analytics' },
        ]}
        actions={
          <Button asChild size="sm">
            <Link href="/dashboard">View Dashboard</Link>
          </Button>
        }
      />

      <Card className="border-border bg-card border-emerald-500/30">
        <CardHeader>
          <CardTitle className="text-lg">In beta right now</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            Open <Link href="/intelligence">Intelligence</Link> for read-only metrics, per-creator and per-platform breakdowns, daily rollups,
            published highlights, and upcoming schedules when your Supabase-backed workspace contains those rows. This is reporting and
            visibility—not automated winner selection.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-6 md:grid-cols-2">
        {analyticsBlocks.map((block) => (
          <Card key={block.title} className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">{block.title}</CardTitle>
              <CardDescription>{block.body}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground">
              Planned depth: charts, exports, alerting, and deeper engagement ingestion once additional social APIs move past stub status.
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">A/B testing</CardTitle>
          <CardDescription className="space-y-2 text-sm leading-relaxed">
            <span className="block">
              <strong className="text-foreground">Roadmap.</strong> Variant definitions for captions, thumbnails, and post times, traffic
              splits, and statistically grounded winners are not shipped as a dedicated experiment console yet.
            </span>
            <span className="block">
              <strong className="text-foreground">Today.</strong> Use Intelligence to compare what already published and iterate manually in
              planner until experiment tooling lands.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Button asChild variant="outline">
            <Link href="/intelligence">Open Intelligence</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
