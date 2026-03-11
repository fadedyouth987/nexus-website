import { getToken } from 'next-auth/jwt'
import { getBlueprintSupabaseAdmin } from './supabaseAdmin'

function getSecret() {
  return process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this'
}

export async function requireBlueprintUser(request: Request) {
  const token = await getToken({ req: request as any, secret: getSecret() })
  const authUserId = typeof token?.id === 'string' ? token.id : null

  if (!authUserId) {
    const error = new Error('Unauthorized')
    ;(error as Error & { status?: number }).status = 401
    throw error
  }

  const admin = getBlueprintSupabaseAdmin()
  const email = typeof token?.email === 'string' ? token.email : null

  const { data: existing } = await admin
    .from('blueprint_users')
    .select('id, email, plan, plan_status, age_verified_at')
    .eq('id', authUserId)
    .maybeSingle()

  if (existing) {
    return { authUserId, profile: existing }
  }

  const { data, error } = await admin
    .from('blueprint_users')
    .insert({ id: authUserId, email })
    .select('id, email, plan, plan_status, age_verified_at')
    .single()

  if (error || !data) {
    const err = new Error('Failed to initialize blueprint user')
    ;(err as Error & { status?: number }).status = 500
    throw err
  }

  return { authUserId, profile: data }
}
