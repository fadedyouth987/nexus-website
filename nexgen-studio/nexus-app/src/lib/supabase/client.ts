import { createClient as createBrowserClient, type SupabaseClient } from '@supabase/supabase-js'
import { requireSupabaseAnonKey, requireSupabaseUrl } from './env'

let browserClient: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(requireSupabaseUrl(), requireSupabaseAnonKey())
  }
  return browserClient
}
