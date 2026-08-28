import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createClient } from '@supabase/supabase-js'
import type { JWT } from 'next-auth/jwt'
import { requireSupabaseAnonKey, requireSupabaseUrl } from '@/lib/supabase/env'

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 60
const ACCESS_TOKEN_REFRESH_BUFFER_SECONDS = 30

declare module 'next-auth' {
  interface User {
    id: string
    vault_mode?: string
    accessToken?: string
    refreshToken?: string
    accessTokenExpiresAt?: number
  }
  interface Session {
    user: {
      id: string
      vault_mode?: string
      accessToken?: string
      refreshToken?: string
      accessTokenExpiresAt?: number
      name?: string | null
      email?: string | null
      image?: string | null
    }
    vault_mode?: string
    error?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    vault_mode?: string
    accessToken?: string
    refreshToken?: string
    accessTokenExpiresAt?: number
    error?: string
  }
}

function resolveAccessTokenExpiry(expiresAt?: number | null, expiresIn?: number | null) {
  if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
    return expiresAt
  }

  const ttl = typeof expiresIn === 'number' && Number.isFinite(expiresIn)
    ? expiresIn
    : DEFAULT_ACCESS_TOKEN_TTL_SECONDS

  return Math.floor(Date.now() / 1000) + ttl
}

function getAuthSecret() {
  const secret = process.env.NEXTAUTH_SECRET?.trim()
  return secret && secret.length >= 32 ? secret : undefined
}

function createSupabaseAuthClient() {
  try {
    return createClient(requireSupabaseUrl(), requireSupabaseAnonKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  } catch {
    return null
  }
}

const supabase = createSupabaseAuthClient()

async function refreshSupabaseAccessToken(token: JWT): Promise<JWT> {
  if (!supabase || typeof token.refreshToken !== 'string' || !token.refreshToken) {
    return { ...token, error: 'RefreshAccessTokenError' }
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: token.refreshToken,
  })

  if (error || !data.session) {
    return { ...token, error: 'RefreshAccessTokenError' }
  }

  return {
    ...token,
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token || token.refreshToken,
    accessTokenExpiresAt: resolveAccessTokenExpiry(data.session.expires_at, data.session.expires_in),
    error: undefined,
  }
}

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'user@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? credentials.email : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''

        if (!email || !password) {
          throw new Error('Email and password are required')
        }

        if (!supabase) {
          throw new Error('Supabase is not configured')
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error || !data.user || !data.session) {
          throw new Error(error?.message || 'Invalid credentials')
        }

        return {
          id: data.user.id,
          email: data.user.email || email,
          name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || 'User',
          image: null,
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          accessTokenExpiresAt: resolveAccessTokenExpiry(data.session.expires_at, data.session.expires_in),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.accessToken = (user as any).accessToken
        token.refreshToken = (user as any).refreshToken
        token.accessTokenExpiresAt = (user as any).accessTokenExpiresAt
        token.vault_mode = 'sfw'
        token.error = undefined
        return token
      }

      const now = Math.floor(Date.now() / 1000)
      const accessTokenExpiresAt = typeof token.accessTokenExpiresAt === 'number'
        ? token.accessTokenExpiresAt
        : 0

      const hasValidAccessToken = Boolean(
        token.accessToken && accessTokenExpiresAt - ACCESS_TOKEN_REFRESH_BUFFER_SECONDS > now
      )

      if (hasValidAccessToken) {
        return token
      }

      if (token.refreshToken) {
        return refreshSupabaseAccessToken(token)
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const id = typeof token.id === 'string' ? token.id : typeof token.sub === 'string' ? token.sub : ''
        session.user.id = id
        session.user.accessToken = typeof token.accessToken === 'string' ? token.accessToken : undefined
        session.user.refreshToken = typeof token.refreshToken === 'string' ? token.refreshToken : undefined
        session.user.accessTokenExpiresAt =
          typeof token.accessTokenExpiresAt === 'number' ? token.accessTokenExpiresAt : undefined
        session.user.vault_mode = typeof token.vault_mode === 'string' ? token.vault_mode : 'sfw'
        session.vault_mode = session.user.vault_mode
      }

      session.error = typeof token.error === 'string' ? token.error : undefined
      return session
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/auth',
    error: '/auth',
  },
}
