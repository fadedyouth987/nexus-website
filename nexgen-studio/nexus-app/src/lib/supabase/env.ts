const SUPABASE_URL_KEYS = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const
const SUPABASE_ANON_KEY_KEYS = ['NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const
const SUPABASE_SERVICE_ROLE_KEY_KEYS = ['SUPABASE_SERVICE_ROLE_KEY'] as const

function readEnv(names: readonly string[]) {
  for (const name of names) {
    const value = process.env[name]
    if (value) {
      return value
    }
  }

  return null
}

function requireEnvAny(names: readonly string[], label: string) {
  const value = readEnv(names)
  if (!value) {
    throw new Error(`Missing required ${label} environment variable: ${names.join(' or ')}`)
  }
  return value
}

export function requireSupabaseUrl() {
  return requireEnvAny(SUPABASE_URL_KEYS, 'Supabase URL')
}

export function requireSupabaseAnonKey() {
  return requireEnvAny(SUPABASE_ANON_KEY_KEYS, 'Supabase anon key')
}

export function requireSupabaseServiceRoleKey() {
  return requireEnvAny(SUPABASE_SERVICE_ROLE_KEY_KEYS, 'Supabase service role key')
}
