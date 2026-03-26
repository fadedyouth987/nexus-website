import Link from 'next/link'
import { SITE_NAME } from '@/lib/sitemap'

export function MarketingFooter() {
  return (
    <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
      <p>
        © {new Date().getFullYear()} {SITE_NAME}.{' '}
        <Link href="/landing" className="underline underline-offset-4 hover:text-foreground">
          Home
        </Link>
        {' · '}
        <Link href="/auth" className="underline underline-offset-4 hover:text-foreground">
          Sign in
        </Link>
      </p>
    </footer>
  )
}
