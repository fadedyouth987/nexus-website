import { createClient } from '@supabase/supabase-js'
import { requireSupabaseServiceRoleKey, requireSupabaseUrl } from '@/lib/supabase/env'

let client: any = null

export function getEngineSupabaseAdmin(): any {
  if (!client) {
    client = createClient(
      requireSupabaseUrl(),
      requireSupabaseServiceRoleKey(),
      { auth: { persistSession: false } }
    )
  }

  return client
}
