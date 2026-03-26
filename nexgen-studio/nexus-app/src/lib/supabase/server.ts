import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { requireSupabaseAnonKey, requireSupabaseUrl } from '@/lib/supabase/env'

/**
 * Supabase client scoped to the signed-in user (NextAuth JWT → Supabase access token).
 * Use in Server Actions and Route Handlers so RLS sees `auth.uid()`.
 */
export async function createClient(_cookieStore?: unknown): Promise<SupabaseClient> {
  const session = await getServerSession(authOptions)
  const token = session?.user?.accessToken

  return createSupabaseClient(requireSupabaseUrl(), requireSupabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  })
}
