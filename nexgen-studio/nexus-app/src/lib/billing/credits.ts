import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export type ReserveCreditsResult =
  | { ok: true; reservedCredits: number; balanceAfter: number }
  | { ok: false; code: 'INSUFFICIENT_CREDITS' | 'RESERVE_FAILED'; message: string }

export type FinalizeCreditsResult =
  | { ok: true; deltaApplied: number }
  | { ok: false; code: 'FINALIZE_FAILED'; message: string }

export async function reserveCredits(input: {
  userId: string
  credits: number
  refType: string
  refId: string
}): Promise<ReserveCreditsResult> {
  const admin = getEngineSupabaseAdmin()
  const amount = Math.max(1, Math.floor(input.credits))

  await admin.from('blueprint_users').upsert(
    {
      id: input.userId,
    },
    { onConflict: 'id', ignoreDuplicates: false }
  )

  const { data, error } = await admin.rpc('reserve_blueprint_credits', {
    p_user_id: input.userId,
    p_amount: amount,
    p_ref_type: input.refType,
    p_ref_id: input.refId,
  })

  if (error) {
    const message = error.message || 'Failed to reserve credits'
    if (message.toLowerCase().includes('insufficient')) {
      return { ok: false, code: 'INSUFFICIENT_CREDITS', message }
    }
    return { ok: false, code: 'RESERVE_FAILED', message }
  }

  const result = (data || {}) as { reserved?: boolean; balance_after?: number }
  if (!result.reserved) {
    return {
      ok: false,
      code: 'INSUFFICIENT_CREDITS',
      message: 'Insufficient credits',
    }
  }

  return {
    ok: true,
    reservedCredits: amount,
    balanceAfter: Number(result.balance_after || 0),
  }
}

export async function finalizeCredits(input: {
  userId: string
  reservedCredits: number
  actualCredits: number
  refType: string
  refId: string
}): Promise<FinalizeCreditsResult> {
  const admin = getEngineSupabaseAdmin()

  const { data, error } = await admin.rpc('finalize_blueprint_credits', {
    p_user_id: input.userId,
    p_reserved_amount: Math.max(0, Math.floor(input.reservedCredits)),
    p_actual_amount: Math.max(0, Math.floor(input.actualCredits)),
    p_ref_type: input.refType,
    p_ref_id: input.refId,
  })

  if (error) {
    return {
      ok: false,
      code: 'FINALIZE_FAILED',
      message: error.message || 'Failed to finalize credits',
    }
  }

  const result = (data || {}) as { delta_applied?: number }
  return {
    ok: true,
    deltaApplied: Number(result.delta_applied || 0),
  }
}
