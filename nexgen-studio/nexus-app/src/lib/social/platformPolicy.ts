export type PublishContentRating = 'sfw' | 'nsfw'

/** SFW = no age gate. NSFW = requires 18+ verification before connecting. */
export type PlatformContentTier = 'sfw' | 'nsfw'

export const PLATFORM_POLICY: Record<
  string,
  {
    label: string
    supportsSfw: boolean
    supportsNsfw: boolean
    integration: 'live' | 'stub' | 'planned'
    /** SFW platforms: connect anytime. NSFW: must verify 18+ before connect. */
    contentTier: PlatformContentTier
  }
> = {
  // SFW: connect via OAuth/API; no age gate
  instagram: { label: 'Instagram', supportsSfw: true, supportsNsfw: false, integration: 'live', contentTier: 'sfw' },
  facebook: { label: 'Facebook', supportsSfw: true, supportsNsfw: false, integration: 'live', contentTier: 'sfw' },
  tiktok: { label: 'TikTok', supportsSfw: true, supportsNsfw: false, integration: 'stub', contentTier: 'sfw' },
  youtube: { label: 'YouTube', supportsSfw: true, supportsNsfw: false, integration: 'stub', contentTier: 'sfw' },
  linkedin: { label: 'LinkedIn', supportsSfw: true, supportsNsfw: false, integration: 'stub', contentTier: 'sfw' },
  pinterest: { label: 'Pinterest', supportsSfw: true, supportsNsfw: false, integration: 'stub', contentTier: 'sfw' },
  threads: { label: 'Threads', supportsSfw: true, supportsNsfw: false, integration: 'planned', contentTier: 'sfw' },
  snapchat: { label: 'Snapchat', supportsSfw: true, supportsNsfw: false, integration: 'planned', contentTier: 'sfw' },
  // NSFW: 18+ verification required before connecting; OnlyFans/Fansly use OAuth or webhook
  twitter: { label: 'X (Twitter)', supportsSfw: true, supportsNsfw: true, integration: 'stub', contentTier: 'sfw' },
  reddit: { label: 'Reddit', supportsSfw: true, supportsNsfw: true, integration: 'stub', contentTier: 'sfw' },
  onlyfans: { label: 'OnlyFans', supportsSfw: true, supportsNsfw: true, integration: 'planned', contentTier: 'nsfw' },
  fansly: { label: 'Fansly', supportsSfw: true, supportsNsfw: true, integration: 'planned', contentTier: 'nsfw' },
}

const PLATFORM_ALIASES: Record<string, string> = {
  x: 'twitter',
  'x-twitter': 'twitter',
  'x_twitter': 'twitter',
  'x/twitter': 'twitter',
  'x (twitter)': 'twitter',
  only_fans: 'onlyfans',
  'only-fans': 'onlyfans',
}

export function normalizePlatformId(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!raw) return ''
  return PLATFORM_ALIASES[raw] || raw
}

export function normalizeContentRating(value: unknown): PublishContentRating {
  return value === 'nsfw' ? 'nsfw' : 'sfw'
}

export function canPublishContentToPlatform(platform: string, rating: PublishContentRating): boolean {
  const policy = PLATFORM_POLICY[normalizePlatformId(platform)]
  if (!policy) return rating === 'sfw'
  return rating === 'nsfw' ? policy.supportsNsfw : policy.supportsSfw
}
