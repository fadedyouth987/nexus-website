/**
 * Unified navigation configuration.
 * Single source of truth for Sidebar, TopBar breadcrumbs, and WorkflowStepper.
 *
 * Architecture decision: Sidebar is primary navigation.
 * WorkflowStepper reflects the same phases but as a linear workflow guide.
 * All app routes must be registered here for discoverability.
 */

import {
  LayoutDashboard,
  FolderKanban,
  Palette,
  BriefcaseBusiness,
  CalendarClock,
  Clapperboard,
  Image,
  BarChart3,
  Building,
  CreditCard,
  Settings,
  LifeBuoy,
  Sparkles,
  Calendar,
  Inbox,
  Users,
  Wand2,
  type LucideIcon,
} from 'lucide-react'

export type NavSection = {
  id: string
  label: string
  phase?: number // Workflow phase (1-6) for stepper alignment
  items: NavItem[]
}

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  description?: string
  badge?: string
  isNew?: boolean
  phase?: number // Override section phase if needed
}

// Canonical app sections aligned with workflow phases
// Phase 1: Create | Phase 2: Generate | Phase 3: Content
// Phase 4: Automate | Phase 5: Publish | Phase 6: Grow
export const APP_NAVIGATION: NavSection[] = [
  {
    id: 'home',
    label: 'Home',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview and activity' },
    ],
  },
  {
    id: 'create',
    label: 'Create',
    phase: 1,
    items: [
      { href: '/creators', label: 'Creators', icon: Users, description: 'AI influencer personas', badge: 'Start', isNew: true },
      { href: '/templates', label: 'Templates', icon: Palette, description: 'Fitness, fashion, lifestyle presets' },
      { href: '/brand-kits', label: 'Brand Kits', icon: Palette, description: 'Visual identity systems' },
    ],
  },
  {
    id: 'generate',
    label: 'Generate',
    phase: 2,
    items: [
      { href: '/studio', label: 'Studio', icon: Sparkles, description: 'Generate images and videos', badge: 'Core' },
      { href: '/video-jobs', label: 'Generation Jobs', icon: Clapperboard, description: 'Batch and track GPU jobs' },
      { href: '/production', label: 'Production', icon: Wand2, description: 'High-volume batch workflows' },
    ],
  },
  {
    id: 'content',
    label: 'Content',
    phase: 3,
    items: [
      { href: '/assets', label: 'Assets', icon: Image, description: 'Generated media library' },
      { href: '/gallery', label: 'Gallery', icon: Image, description: 'Curated content collections' },
      { href: '/vault', label: 'Vault', icon: Image, description: 'Secure content storage' },
    ],
  },
  {
    id: 'automate',
    label: 'Automate',
    phase: 4,
    items: [
      { href: '/automation', label: 'Automation Hub', icon: Wand2, description: 'Orchestrate workflows', badge: 'Hub' },
      { href: '/planner', label: 'Content Planner', icon: BriefcaseBusiness, description: 'AI-assisted 30-day planning' },
      { href: '/schedules', label: 'Schedules', icon: CalendarClock, description: 'Queued content calendar' },
      { href: '/campaigns', label: 'Campaigns', icon: BriefcaseBusiness, description: 'Multi-platform campaigns' },
      { href: '/projects', label: 'Projects', icon: FolderKanban, description: 'Organized content projects' },
    ],
  },
  {
    id: 'publish',
    label: 'Publish',
    phase: 5,
    items: [
      { href: '/calendar', label: 'Calendar', icon: Calendar, description: 'Publishing calendar and queues' },
      { href: '/socials', label: 'Socials', icon: Inbox, description: 'Connected platforms' },
      { href: '/inbox', label: 'Inbox', icon: Inbox, description: 'Engagement and replies' },
    ],
  },
  {
    id: 'grow',
    label: 'Grow',
    phase: 6,
    items: [
      { href: '/analytics', label: 'Analytics', icon: BarChart3, description: 'Performance insights' },
      { href: '/monetization', label: 'Monetization', icon: CreditCard, description: 'Revenue and vault access' },
      { href: '/agency', label: 'Agency', icon: Building, description: 'Multi-creator management' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { href: '/billing', label: 'Billing', icon: CreditCard, description: 'Subscriptions and usage' },
      { href: '/settings', label: 'Settings', icon: Settings, description: 'Preferences and configuration' },
      { href: '/contact', label: 'Support', icon: LifeBuoy, description: 'Help and documentation' },
    ],
  },
]

// Flat route map for quick lookup (breadcrumb titles, redirects, etc.)
export const ROUTE_METADATA: Record<string, { title: string; section?: string; phase?: number }> = {}

// Build flat map from navigation
APP_NAVIGATION.forEach((section) => {
  section.items.forEach((item) => {
    ROUTE_METADATA[item.href] = {
      title: item.label,
      section: section.label,
      phase: item.phase ?? section.phase,
    }

    // Also register common sub-routes patterns
    ROUTE_METADATA[`${item.href}/new`] = { title: `New ${item.label}`, section: section.label }
    ROUTE_METADATA[`${item.href}/create`] = { title: `Create ${item.label}`, section: section.label }
  })
})

// Additional routes not in main nav (sub-pages, legacy redirects)
export const ADDITIONAL_ROUTES: Record<string, { title: string; redirectTo?: string }> = {
  // Legacy / duplicate resolution
  '/automation/scheduler': { title: 'Scheduler', redirectTo: '/schedules' }, // Canonical: /schedules
  '/automation/scheduling': { title: 'Scheduling', redirectTo: '/schedules' }, // Deduplicated
  '/automation/planner': { title: 'Content Planner', redirectTo: '/planner' }, // Canonical: /planner
  '/social': { title: 'Socials', redirectTo: '/socials' }, // Canonical: /socials
  '/organizations': { title: 'Organizations' }, // Sub-page under agency
  '/models': { title: 'Models' }, // Sub-page under studio
  '/posts': { title: 'Posts', redirectTo: '/schedules' }, // Legacy, redirects to schedules
  '/influencers': { title: 'Influencers', redirectTo: '/creators' }, // Legacy alias
  '/edit': { title: 'Edit' }, // Sub-feature of studio
  '/design': { title: 'Design' }, // Sub-feature of studio
  '/learn': { title: 'Documentation' },
  '/audit-logs': { title: 'Audit Logs' },
  '/settings/verification': { title: 'Age & Content Settings' },
  '/settings/billing': { title: 'Billing Settings' },
  '/settings/team': { title: 'Team Management' },
  '/settings/organization': { title: 'Organization Settings' },
}

// Merge additional routes
Object.entries(ADDITIONAL_ROUTES).forEach(([path, meta]) => {
  if (!ROUTE_METADATA[path]) {
    ROUTE_METADATA[path] = { title: meta.title }
  }
})

// Workflow phase configuration (for WorkflowStepper)
export const WORKFLOW_PHASES = [
  { id: 1, label: 'Create', href: '/creators', icon: Users },
  { id: 2, label: 'Generate', href: '/studio', icon: Sparkles },
  { id: 3, label: 'Content', href: '/assets', icon: Image },
  { id: 4, label: 'Automate', href: '/automation', icon: Wand2 },
  { id: 5, label: 'Publish', href: '/calendar', icon: Calendar },
  { id: 6, label: 'Grow', href: '/analytics', icon: BarChart3 },
] as const

// Helper: Get title for any pathname
export function getRouteTitle(pathname: string): string {
  // Exact match
  if (ROUTE_METADATA[pathname]) {
    return ROUTE_METADATA[pathname].title
  }

  // Prefix match (for sub-routes like /studio/123)
  for (const [path, meta] of Object.entries(ROUTE_METADATA).sort((a, b) => b[0].length - a[0].length)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return meta.title
    }
  }

  return 'Workspace'
}

// Helper: Get section for any pathname
export function getRouteSection(pathname: string): string | undefined {
  for (const [path, meta] of Object.entries(ROUTE_METADATA).sort((a, b) => b[0].length - a[0].length)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return meta.section
    }
  }
  return undefined
}

// Helper: Get phase for any pathname
export function getRoutePhase(pathname: string): number | undefined {
  for (const [path, meta] of Object.entries(ROUTE_METADATA).sort((a, b) => b[0].length - a[0].length)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return meta.phase
    }
  }
  return undefined
}

// Helper: Check if route should redirect
export function getRouteRedirect(pathname: string): string | undefined {
  const exact = ADDITIONAL_ROUTES[pathname]
  if (exact?.redirectTo) return exact.redirectTo

  // Check prefixes for sub-route redirects
  for (const [path, meta] of Object.entries(ADDITIONAL_ROUTES)) {
    if (meta.redirectTo && (pathname === path || pathname.startsWith(`${path}/`))) {
      return meta.redirectTo
    }
  }
  return undefined
}

// Flat list for navTitles compatibility (TopBar)
export const NAV_TITLE_OVERRIDES: Array<{ prefix: string; title: string }> = [
  { prefix: '/dashboard', title: 'Dashboard' },
  { prefix: '/projects', title: 'Projects' },
  { prefix: '/brand-kits', title: 'Brand Kits' },
  { prefix: '/campaigns', title: 'Campaigns' },
  { prefix: '/schedules', title: 'Schedules' },
  { prefix: '/video-jobs', title: 'Generation Jobs' },
  { prefix: '/assets', title: 'Assets' },
  { prefix: '/analytics', title: 'Analytics' },
  { prefix: '/agency', title: 'Agency' },
  { prefix: '/billing', title: 'Billing' },
  // Settings sub-pages with distinct names (avoid duplicate "Billing" labels)
  { prefix: '/settings/verification', title: 'Age & Content Settings' },
  { prefix: '/settings/billing', title: 'Subscription and Billing' },
  { prefix: '/settings/team', title: 'Team Management' },
  { prefix: '/settings/organization', title: 'Organization Settings' },
  { prefix: '/settings', title: 'Settings' },
  // New primary routes
  { prefix: '/creators', title: 'Creators' },
  { prefix: '/studio', title: 'Studio' },
  { prefix: '/production', title: 'Production' },
  { prefix: '/gallery', title: 'Gallery' },
  { prefix: '/vault', title: 'Vault' },
  { prefix: '/automation', title: 'Automation' },
  { prefix: '/planner', title: 'Content Planner' },
  { prefix: '/calendar', title: 'Calendar' },
  { prefix: '/socials', title: 'Socials' },
  { prefix: '/inbox', title: 'Inbox' },
  { prefix: '/monetization', title: 'Monetization' },
  { prefix: '/templates', title: 'Templates' },
  { prefix: '/learn', title: 'Documentation' },
  { prefix: '/contact', title: 'Support' },
  { prefix: '/audit-logs', title: 'Audit Logs' },
  { prefix: '/models', title: 'Models' },
  { prefix: '/organizations', title: 'Organizations' },
]
