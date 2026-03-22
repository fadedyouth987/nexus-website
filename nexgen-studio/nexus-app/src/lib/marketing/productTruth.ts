/**
 * Canonical, explicit copy: what Nexus Studio does today vs what is still rolling out.
 * Used on landing, learn, and analytics so marketing matches the product.
 */

export type ValuePropBlock = {
  title: string
  /** Short line under the title on cards */
  lead: string
  /** Explicit bullets — no vague superlatives */
  details: string[]
  image: string
  alt: string
}

export const VALUE_PROP_BLOCKS: ValuePropBlock[] = [
  {
    title: 'Creation',
    lead: 'GPU-backed stills and video through Studio workflows.',
    details: [
      'Generation runs through ComfyUI-style pipelines on workers you configure; queue time scales with GPU load, job size, and concurrency.',
      'Presets, prompts, and reference assets are built to keep identity and style consistent across outputs—not a single magic toggle.',
      'Optional custom checkpoints, LoRAs, and VAEs (safetensors / ckpt / pt) upload into SFW or NSFW storage buckets based on policy and your markings.',
    ],
    image: '/landing/creation-scene.svg',
    alt: 'Creation studio preview artwork',
  },
  {
    title: 'Automation',
    lead: 'Planner, queues, and workers chain strategy into scheduled posts.',
    details: [
      'AI Influencer Factory, content planner, scheduler, publish worker, and retry worker are the spine: plan → queue → dispatch → publish → recover.',
      'Engagement and monetization surfaces are wired into the same OS; what actually runs end-to-end still depends on connected accounts and worker health.',
      'Use /automation/factory for a guided first pass, then refine in planner and dashboard routes.',
    ],
    image: '/landing/automation-scene.svg',
    alt: 'Automation pipeline artwork',
  },
  {
    title: 'Growth',
    lead: 'Read-first analytics now; broad platform coverage is staged.',
    details: [
      'OAuth publishing is live for Instagram and Facebook. TikTok, YouTube, LinkedIn, Pinterest, X, and Reddit are stubbed; Threads, Snapchat, OnlyFans, and Fansly are planned—see Learn for the matrix.',
      'Intelligence and portfolio pull read-only metrics, schedules, and highlights from your workspace when data exists; richer reporting is still expanding.',
      'Caption, thumbnail, and post-time A/B testing is on the roadmap—the /analytics page describes current vs planned scope.',
    ],
    image: '/landing/growth-scene.svg',
    alt: 'Growth dashboard artwork',
  },
]

/** Short facts for hero stat row — numbers match platformPolicy + architecture */
export const HERO_STATS = [
  { value: '24/7', label: 'Queued jobs & automation workers' },
  { value: '2', label: 'Live OAuth networks (Instagram, Facebook)' },
  { value: '1 OS', label: 'Studio, planner, vault, billing' },
] as const

export const BETA_CAPABILITY_CHECKLIST: { title: string; body: string }[] = [
  {
    title: 'Live today',
    body:
      'Sign-in, organizations, Studio generation, gallery/vault patterns, planner and scheduler UI, Instagram/Facebook connect flows, Stripe-oriented billing surfaces, and NSFW gating hooks as documented in Learn.',
  },
  {
    title: 'Explicitly staged',
    body:
      'Additional social networks, full experiment tooling for A/B tests, and some worker paths still carry stub or placeholder classification—check Learn and dashboard social for the live matrix.',
  },
  {
    title: 'Why pages feel fast',
    body:
      'The marketing shell is a static Next.js export: HTML and assets are served from the edge; only waitlist and app API calls hit your backend. In-app actions depend on Supabase, workers, and GPU queues.',
  },
]
