import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireSupabaseUrl } from '@/lib/supabase/env'

let adminClient: SupabaseClient | null = null

export function getSupabaseAdmin() {
  if (adminClient) {
    return adminClient
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for server-side repositories')
  }

  adminClient = createClient(requireSupabaseUrl(), serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return adminClient
}
