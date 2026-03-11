import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'

export const metadata = {
  title: 'Analytics | NexGen Studio',
  description: 'Growth charts, engagement metrics, content performance, series analytics, A/B testing.',
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
        description="Data-driven growth: charts, engagement, content performance, and A/B tests."
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

      <section className="grid gap-6 md:grid-cols-2">
        {analyticsBlocks.map((block) => (
          <Card key={block.title} className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-lg">{block.title}</CardTitle>
              <CardDescription>{block.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">A/B testing</CardTitle>
          <CardDescription>
            Test captions, thumbnails, and posting times. Optimize with measurable data.
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
