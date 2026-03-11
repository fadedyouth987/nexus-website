import { getBlueprintSupabaseAdmin } from './supabaseAdmin'

export async function getBlueprintCreditBalance(userId: string) {
  const admin = getBlueprintSupabaseAdmin()
  const { data, error } = await admin.rpc('blueprint_credit_balance', {
    p_user_id: userId,
  })

  if (error) {
    throw new Error(error.message)
  }

  return Number(data || 0)
}

export async function reserveBlueprintCredits(
  userId: string,
  cost: number,
  refType: string,
  refId: string
) {
  const balance = await getBlueprintCreditBalance(userId)
  if (balance < cost) {
    const error = new Error('Insufficient credits')
    ;(error as Error & { status?: number }).status = 402
    throw error
  }

  const admin = getBlueprintSupabaseAdmin()
  const { error } = await admin.from('credit_ledger').insert({
    user_id: userId,
    delta: -cost,
    reason: 'RESERVE_JOB',
    ref_type: refType,
    ref_id: refId,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function releaseBlueprintCredits(
  userId: string,
  cost: number,
  refType: string,
  refId: string,
  reason = 'RELEASE_RESERVE'
) {
  const admin = getBlueprintSupabaseAdmin()
  const { error } = await admin.from('credit_ledger').insert({
    user_id: userId,
    delta: cost,
    reason,
    ref_type: refType,
    ref_id: refId,
  })

  if (error) {
    throw new Error(error.message)
  }
}
