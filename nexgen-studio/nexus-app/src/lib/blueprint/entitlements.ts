export function isPlanActive(user: { plan_status: string }) {
  return user.plan_status === 'ACTIVE'
}

export function canUseNSFW(user: { plan: string; plan_status: string; age_verified_at: string | null }) {
  return isPlanActive(user) && (user.plan === 'VAULT' || user.plan === 'ENTERPRISE') && !!user.age_verified_at
}

export function vaultEnabled(user: { plan: string; plan_status: string }) {
  return isPlanActive(user) && (user.plan === 'VAULT' || user.plan === 'ENTERPRISE')
}

export function canViewTemplate(
  user: { plan: string; plan_status: string; age_verified_at: string | null },
  template: { is_active: boolean; content_policy: string }
) {
  if (!template.is_active) return false
  if (template.content_policy === 'SFW') return isPlanActive(user)
  return canUseNSFW(user)
}

export function canGenerate(
  user: { plan: string; plan_status: string; age_verified_at: string | null },
  template: { is_active: boolean; content_policy: string }
) {
  return canViewTemplate(user, template)
}

export function maxConcurrentJobs(user: { plan: string; plan_status: string }) {
  if (!isPlanActive(user)) return 0
  switch (user.plan) {
    case 'STARTER':
      return 1
    case 'PRO':
    case 'VAULT':
      return 2
    case 'ENTERPRISE':
      return 5
    default:
      return 0
  }
}
