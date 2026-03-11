import type { SocialProviderId } from '../providerInterface'
import type { ISocialProvider } from '../providerInterface'
import { instagramProvider } from './instagram'
import { facebookProvider } from './facebook'
import { createStubProvider } from './stubProvider'

const stubs: SocialProviderId[] = ['tiktok', 'twitter', 'youtube', 'linkedin', 'pinterest', 'reddit']

const providerMap: Record<SocialProviderId, ISocialProvider> = {
  instagram: instagramProvider,
  facebook: facebookProvider,
  tiktok: createStubProvider('tiktok'),
  twitter: createStubProvider('twitter'),
  youtube: createStubProvider('youtube'),
  linkedin: createStubProvider('linkedin'),
  pinterest: createStubProvider('pinterest'),
  reddit: createStubProvider('reddit'),
}

export function getProvider(providerId: SocialProviderId): ISocialProvider {
  const p = providerMap[providerId]
  if (!p) throw new Error(`Unknown provider: ${providerId}`)
  return p
}

export const VALID_PROVIDERS: SocialProviderId[] = Object.keys(providerMap) as SocialProviderId[]
export { instagramProvider, facebookProvider }
