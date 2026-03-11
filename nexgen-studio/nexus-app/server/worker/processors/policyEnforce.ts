import { canUseNSFW, vaultEnabled } from '../../../src/lib/blueprint/entitlements'

export function assertJobAllowed(user: any, job: any) {
  if (user.plan_status !== 'ACTIVE') {
    throw new Error('PLAN_NOT_ACTIVE')
  }
  if (job.content_policy === 'NSFW') {
    if (!vaultEnabled(user) || !canUseNSFW(user)) {
      throw new Error('NSFW_NOT_ALLOWED')
    }
  }
}
