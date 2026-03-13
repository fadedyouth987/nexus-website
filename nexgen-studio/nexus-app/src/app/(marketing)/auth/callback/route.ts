import { createClient } from '@supabase/supabase-js'
import { encode } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import { requireSupabaseAnonKey, requireSupabaseUrl } from '@/lib/supabase/env'

const DEFAULT_AUTH_SECRET = 'your-secret-key-change-this'
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 60
const NEXTAUTH_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

function isV2Enabled() {
  const raw = process.env.ENABLE_V2_PORTFOLIO || process.env.NEXT_PUBLIC_ENABLE_V2_PORTFOLIO || ''
  return raw === '1' || raw.toLowerCase() === 'true'
}

function shouldUseSecureCookies(request: Request) {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.startsWith('https://')
  }
  return request.url.startsWith('https://')
}

function getSessionCookieName(request: Request) {
  return `${shouldUseSecureCookies(request) ? '__Secure-' : ''}next-auth.session-token`
}

function resolveAccessTokenExpiry(expiresAt?: number | null, expiresIn?: number | null) {
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    return expiresAt
  }

  const ttl =
    typeof expiresIn === 'number' && Number.isFinite(expiresIn)
      ? expiresIn
      : DEFAULT_ACCESS_TOKEN_TTL_SECONDS

  return Math.floor(Date.now() / 1000) + ttl
}

function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET || DEFAULT_AUTH_SECRET
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const defaultNext = isV2Enabled() ? '/portfolio' : '/dashboard'
  const next = searchParams.get('next') ?? defaultNext
  const safeNext = next.startsWith('/') ? next : defaultNext

  if (!code) {
    return NextResponse.redirect(new URL('/auth/auth-code-error', request.url))
  }

  let supabase
  try {
    supabase = createClient(requireSupabaseUrl(), requireSupabaseAnonKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  } catch {
    return NextResponse.redirect(new URL('/auth/auth-code-error', request.url))
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data?.session || !data.user) {
    return NextResponse.redirect(new URL('/auth/auth-code-error', request.url))
  }

  const sessionToken = await encode({
    secret: getAuthSecret(),
    maxAge: NEXTAUTH_SESSION_MAX_AGE_SECONDS,
    token: {
      sub: data.user.id,
      id: data.user.id,
      name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
      email: data.user.email,
      vault_mode: 'sfw',
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      accessTokenExpiresAt: resolveAccessTokenExpiry(data.session.expires_at, data.session.expires_in),
    },
  })

  const response = NextResponse.redirect(new URL(safeNext, request.url))
  response.cookies.set({
    name: getSessionCookieName(request),
    value: sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: shouldUseSecureCookies(request),
    path: '/',
    maxAge: NEXTAUTH_SESSION_MAX_AGE_SECONDS,
  })

  return response
}
