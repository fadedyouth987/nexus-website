import type { Metadata } from 'next'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { OrganizationProvider } from '@/context/OrganizationContext'
import { SITE_NAME } from '@/lib/sitemap'

export const metadata: Metadata = {
  title: SITE_NAME,
  description: 'Create, automate, and grow AI influencers end-to-end.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <SessionProvider>
          <OrganizationProvider>{children}</OrganizationProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
