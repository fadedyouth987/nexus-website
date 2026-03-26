import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireSupabaseServiceRoleKey, requireSupabaseUrl } from '@/lib/supabase/env'

/** Service role client (bypasses RLS). Use only on the server / worker. */
export function createServiceClient(): SupabaseClient {
  return createClient(requireSupabaseUrl(), requireSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
