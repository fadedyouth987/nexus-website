/**
 * Production-ready website sitemap.
 * Use for nav, footer, and route generation.
 */

export const SITE_NAME = 'Nexus Studio'

export type SitemapLink = {
  href: string
  label: string
  description?: string
  children?: SitemapLink[]
}

/** Public marketing + product pages (for header/footer) */
export const PUBLIC_SITEMAP: SitemapLink[] = [
  { href: '/landing', label: 'Home', description: 'Create, automate, and grow AI influencers end-to-end.' },
  { href: '/create', label: 'Influencer Creation', description: 'Photoreal generation, presets, identity consistency.' },
  {
    href: '/automation',
    label: 'Automation',
    description: 'Content, media, scheduling, engagement, analytics, monetization, agency.',
    children: [
      { href: '/automation/planner', label: 'Content planner' },
      { href: '/automation/scheduler', label: 'Scheduler' },
      { href: '/automation/content', label: 'Content Automation' },
      { href: '/automation/media', label: 'Media Automation' },
      { href: '/automation/scheduling', label: 'Scheduling Automation' },
      { href: '/automation/engagement', label: 'Engagement Automation' },
      { href: '/automation/analytics', label: 'Analytics Automation' },
      { href: '/automation/monetization', label: 'Monetization Automation' },
      { href: '/automation/agency', label: 'Agency Automation' },
    ],
  },
  { href: '/studio', label: 'Studio', description: 'Generate, edit, manage assets, run workflows.' },
  {
    href: '/analytics',
    label: 'Analytics',
    description: 'Intelligence metrics today; charts, funnels, and A/B experiments on the roadmap.',
  },
  { href: '/monetization', label: 'Monetization', description: 'Paid posts, affiliate, NSFW gating, merch.' },
  { href: '/agency', label: 'Agency', description: 'Multi-creator, workspaces, reporting.' },
  { href: '/pricing', label: 'Pricing', description: 'Free, Creator, Agency tiers. Credit-based GPU.' },
  { href: '/learn', label: 'Learn', description: 'Docs: consistent influencers, autopilot, integrations.' },
  { href: '/templates', label: 'Templates', description: 'Fitness, fashion, gamer, CEO, lifestyle.' },
  { href: '/showcase', label: 'Showcase', description: 'Top influencers and case studies.' },
  { href: '/blog', label: 'Blog', description: 'AI influencer, content automation, marketing.' },
]

/** Automation sub-pages content (for /automation/[slug]) */
export const AUTOMATION_PAGES: Record<
  string,
  { title: string; description: string; cta: string; ctaHref?: string }
> = {
  content: {
    title: 'Content Automation',
    description: 'Ideas, scripts, captions, 30‑day plans, series engine. Plan and scale content without the grind.',
    cta: 'Open in Studio',
    ctaHref: '/studio',
  },
  media: {
    title: 'Media Automation',
    description: 'Image and video generation, batch jobs, seed control, upscaling. One workflow, many outputs.',
    cta: 'Open in Studio',
    ctaHref: '/studio',
  },
  scheduling: {
    title: 'Scheduling Automation',
    description: 'Auto-posting, best times, queues, 30‑day autopilot. Set it once, run everywhere.',
    cta: 'View Scheduler',
    ctaHref: '/automation/scheduler',
  },
  engagement: {
    title: 'Engagement Automation',
    description: 'Comment replies, DMs, persona voice, sentiment-aware responses. Your influencer never sleeps.',
    cta: 'Open Inbox',
    ctaHref: '/inbox',
  },
  analytics: {
    title: 'Analytics Automation',
    description: 'Performance insights, growth charts, A/B testing, series analytics. Data-driven growth.',
    cta: 'Open Analytics',
    ctaHref: '/analytics',
  },
  monetization: {
    title: 'Monetization Automation',
    description: 'Paid posts, affiliate flows, NSFW gating, merch drops, billing. Turn influence into revenue.',
    cta: 'Open Monetization',
    ctaHref: '/monetization',
  },
  agency: {
    title: 'Agency Automation',
    description: 'Multi-creator workflows, permissions, reporting, bulk actions. Built for studios.',
    cta: 'Agency Dashboard',
    ctaHref: '/agency',
  },
}

/** App routes (post-login) for quick links */
export const APP_ROUTES = {
  studio: '/studio',
  calendar: '/automation/scheduler',
  planner: '/automation/planner',
  automation: '/automation',
  dashboard: '/dashboard',
  vault: '/vault',
  agency: '/agency',
  auth: '/auth',
} as const
