import { createClient as createServerClient, type SupabaseClient } from '@supabase/supabase-js'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { requireSupabaseAnonKey, requireSupabaseUrl } from './env'

export async function createClient(_cookieStore?: unknown): Promise<SupabaseClient> {
  const session = await getServerSession(authOptions)
  const accessToken = session?.user?.accessToken

  const options = accessToken
    ? {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    : undefined

  return createServerClient(requireSupabaseUrl(), requireSupabaseAnonKey(), options)
}
