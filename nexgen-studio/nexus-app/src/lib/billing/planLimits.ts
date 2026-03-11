export type NormalizedPlan = 'STARTER' | 'PRO' | 'VAULT' | 'ENTERPRISE'

const OUTPUT_COUNT_KEYS = [
  'batch_size',
  'batchSize',
  'output_count',
  'outputCount',
  'num_outputs',
  'numOutputs',
  'num_images',
  'numImages',
  'outputs',
  'count',
]

function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  const intValue = Math.floor(parsed)
  return intValue > 0 ? intValue : null
}

function resolveFromObject(payload: Record<string, unknown>): number | null {
  for (const key of OUTPUT_COUNT_KEYS) {
    const value = parsePositiveInt(payload[key])
    if (value !== null) return value
  }
  return null
}

export function normalizePlan(plan: unknown): NormalizedPlan {
  const value = typeof plan === 'string' ? plan.trim().toUpperCase() : ''
  if (value === 'PRO') return 'PRO'
  if (value === 'VAULT') return 'VAULT'
  if (value === 'ENTERPRISE' || value === 'AGENCY' || value === 'SCALE') return 'ENTERPRISE'
  return 'STARTER'
}

export function generationOutputLimitByPlan(plan: unknown): number {
  switch (normalizePlan(plan)) {
    case 'ENTERPRISE':
      return 24
    case 'PRO':
    case 'VAULT':
      return 8
    case 'STARTER':
    default:
      return 2
  }
}

export function editBatchLimitByPlan(plan: unknown): number {
  return generationOutputLimitByPlan(plan)
}

export function resolveRequestedOutputCount(payload: Record<string, unknown>): number {
  const direct = resolveFromObject(payload)
  if (direct !== null) return direct

  const nestedKeys = ['inputs', 'variables', 'params']
  for (const nestedKey of nestedKeys) {
    const nestedValue = payload[nestedKey]
    if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
      const nested = resolveFromObject(nestedValue as Record<string, unknown>)
      if (nested !== null) return nested
    }
  }

  return 1
}
