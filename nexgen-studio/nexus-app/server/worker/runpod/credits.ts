import {
  finalizeCredits as finalizeBillingCredits,
  reserveCredits as reserveBillingCredits,
} from '../../../src/lib/billing/credits'

const A100_CREDITS_PER_HOUR = 220
const DEFAULT_OVERHEAD_MULTIPLIER = 1.1

function toCredits(hours: number, overheadMultiplier = DEFAULT_OVERHEAD_MULTIPLIER) {
  return Math.max(1, Math.ceil(hours * A100_CREDITS_PER_HOUR * overheadMultiplier))
}

export function estimateA100Credits(runtimeSeconds: number) {
  const hours = Math.max(0, runtimeSeconds) / 3600
  return toCredits(hours)
}

export async function reserveCredits(input: { userId: string; jobRef: string; estimatedCredits: number }) {
  const result = await reserveBillingCredits({
    userId: input.userId,
    credits: input.estimatedCredits,
    refType: 'MODEL_GPU_JOB',
    refId: input.jobRef,
  })

  if (!result.ok) {
    const error = new Error(result.message) as Error & { status?: number }
    error.status = result.code === 'INSUFFICIENT_CREDITS' ? 402 : 500
    throw error
  }
}

export async function finalizeCredits(input: {
  userId: string
  jobRef: string
  estimatedCredits: number
  actualCredits: number
}) {
  const result = await finalizeBillingCredits({
    userId: input.userId,
    reservedCredits: input.estimatedCredits,
    actualCredits: input.actualCredits,
    refType: 'MODEL_GPU_JOB',
    refId: input.jobRef,
  })

  if (!result.ok) {
    throw new Error(result.message)
  }
}
