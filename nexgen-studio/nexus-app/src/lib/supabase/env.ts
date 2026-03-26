function readEnv(...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = process.env[key]
    if (typeof v === 'string' && v.trim() !== '') {
      return v.trim()
    }
  }
  return undefined
}

export function requireSupabaseUrl(): string {
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)')
  }
  return url
}

export function requireSupabaseAnonKey(): string {
  const key = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY')
  if (!key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_ANON_KEY)')
  }
  return key
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return readEnv('SUPABASE_SERVICE_ROLE_KEY')
}

export function requireSupabaseServiceRoleKey(): string {
  const key = getSupabaseServiceRoleKey()
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  return key
}
