import { getEngineSupabaseAdmin } from './supabaseAdmin'
import { getToken } from 'next-auth/jwt'

export type EngineProfile = {
  id: string
  email: string | null
  plan: string
  plan_status: string
  age_verified_at: string | null
}

export type EngineUserContext = {
  authUserId: string
  profile: EngineProfile
}

function accessError(message: string, status: number) {
  const error = new Error(message) as Error & { status?: number }
  error.status = status
  return error
}

function readBearerToken(request: Request) {
  const header = request.headers.get('authorization') || request.headers.get('Authorization')
  if (!header) return null

  const [scheme, token] = header.split(' ')
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

async function readSessionTokenFromCookie(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })

  return typeof token?.accessToken === 'string' ? token.accessToken : null
}

export async function getEngineUser(request: Request): Promise<EngineUserContext> {
  const accessToken = readBearerToken(request) || (await readSessionTokenFromCookie(request))
  if (!accessToken) {
    throw accessError('Unauthorized', 401)
  }

  const admin = getEngineSupabaseAdmin()
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(accessToken)

  if (authError || !user?.id) {
    throw accessError('Unauthorized', 401)
  }

  const { data: existing } = await admin
    .from('blueprint_users')
    .select('id, email, plan, plan_status, age_verified_at')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) {
    return {
      authUserId: user.id,
      profile: existing as EngineProfile,
    }
  }

  const { data: created, error: createError } = await admin
    .from('blueprint_users')
    .insert({ id: user.id, email: user.email || null })
    .select('id, email, plan, plan_status, age_verified_at')
    .single()

  if (createError || !created) {
    throw accessError('Failed to initialize blueprint user', 500)
  }

  return {
    authUserId: user.id,
    profile: created as EngineProfile,
  }
}
