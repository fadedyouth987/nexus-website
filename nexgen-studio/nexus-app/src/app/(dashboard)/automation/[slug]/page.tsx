import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AUTOMATION_PAGES } from '@/lib/sitemap'

const VALID_SLUGS = Object.keys(AUTOMATION_PAGES)

type Props = { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return VALID_SLUGS.map((slug) => ({ slug }))
}

export default async function AutomationSlugPage({ params }: Props) {
  const { slug } = await params
  const page = AUTOMATION_PAGES[slug]
  if (!page) notFound()

  if (page.ctaHref) {
    redirect(page.ctaHref)
  }

  return (
    <div className="space-y-[var(--section-gap)]">
      <div>
        <Link href="/automation" className="text-sm text-muted-foreground hover:text-foreground">
          ← Automation
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{page.title}</h1>
        <p className="mt-1 text-muted-foreground">{page.description}</p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Button asChild>
          <Link href={page.ctaHref ?? '/studio'}>{page.cta}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/automation">All automation</Link>
        </Button>
      </div>
    </div>
  )
}
