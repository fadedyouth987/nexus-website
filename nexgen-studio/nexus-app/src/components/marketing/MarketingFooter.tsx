import Link from 'next/link'
import { SITE_NAME } from '@/lib/sitemap'

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 py-8">
      <div className="app-page-shell flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
        <div className="font-semibold text-foreground">{SITE_NAME}</div>
        <div className="flex items-center gap-6">
          <Link href="/legal/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <Link href="/legal/acceptable-use" className="transition-colors hover:text-foreground">
            Policy
          </Link>
          <Link href="/contact" className="transition-colors hover:text-foreground">
            Contact
          </Link>
        </div>
        <p>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</p>
      </div>
    </footer>
  )
}
