/** Public navigation and shared route labels for Jobryn. */

export const SITE_NAME = 'Jobryn'

export type SitemapLink = {
  href: string
  label: string
  description?: string
  children?: SitemapLink[]
}

export const PUBLIC_SITEMAP: SitemapLink[] = [
  { href: '/landing', label: 'Home', description: 'Turn enquiries into booked work and paid revenue.' },
  { href: '/features', label: 'Features', description: 'CRM, conversations, bookings, jobs, quotes, invoices, payments, and automation.' },
  { href: '/pricing', label: 'Pricing', description: 'Plans for service businesses using Jobryn.' },
  { href: '/learn', label: 'Learn', description: 'Guides for setting up and operating Jobryn.' },
  { href: '/about', label: 'About', description: 'Why Jobryn exists and what it is built to solve.' },
  { href: '/contact', label: 'Contact', description: 'Get in touch with Jobryn.' },
]

export const AUTOMATION_PAGES: Record<
  string,
  { title: string; description: string; cta: string; ctaHref?: string }
> = {
  followup: {
    title: 'Lead Follow-up',
    description: 'Keep enquiries moving with clear next actions and automated follow-up.',
    cta: 'Open Dashboard',
    ctaHref: '/dashboard',
  },
  booking: {
    title: 'Booking Automation',
    description: 'Move qualified enquiries into scheduled work without losing customer context.',
    cta: 'Open Calendar',
    ctaHref: '/calendar',
  },
  revenue: {
    title: 'Revenue Automation',
    description: 'Connect jobs, quotes, invoices, payments, reviews, and repeat business.',
    cta: 'Open Dashboard',
    ctaHref: '/dashboard',
  },
}

export const APP_ROUTES = {
  dashboard: '/dashboard',
  calendar: '/calendar',
  automation: '/automation',
  settings: '/settings',
  auth: '/auth',
} as const
