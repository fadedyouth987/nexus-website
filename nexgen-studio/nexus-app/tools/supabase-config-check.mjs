#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const requiredKeys = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
]

function parseDotEnvFile(filepath) {
  if (!fs.existsSync(filepath)) {
    return {}
  }

  const out = {}
  const lines = fs.readFileSync(filepath, 'utf8').split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim()
    out[key] = value
  }
  return out
}

function mask(value) {
  if (!value) return '(missing)'
  if (value.length <= 10) return '**********'
  return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function isPlaceholder(value) {
  if (!value) return true
  return (
    value.includes('__REPLACE_ME') ||
    value.includes('...') ||
    value.toLowerCase().includes('changeme')
  )
}

function isValidSupabaseUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    return Boolean(url.hostname)
  } catch {
    return false
  }
}

async function maybePing(url, anonKey) {
  const endpoint = `${url.replace(/\/+$/, '')}/auth/v1/settings`
  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: anonKey,
    },
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Ping failed (${res.status}): ${body || 'No body'}`)
  }
}

async function main() {
  const cwd = process.cwd()
  const envPath = path.join(cwd, '.env.local')
  const fileEnv = parseDotEnvFile(envPath)
  const env = { ...fileEnv, ...process.env }
  const wantsPing = process.argv.includes('--ping')

  const issues = []

  for (const key of requiredKeys) {
    if (!env[key] || String(env[key]).trim() === '') {
      issues.push(`${key} is missing`)
    } else if (isPlaceholder(String(env[key]))) {
      issues.push(`${key} looks like a placeholder value`)
    }
  }

  const publicUrl = String(env.NEXT_PUBLIC_SUPABASE_URL || '')
  const privateUrl = String(env.SUPABASE_URL || '')
  const anon = String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')
  const service = String(env.SUPABASE_SERVICE_ROLE_KEY || '')

  if (publicUrl && !isValidSupabaseUrl(publicUrl)) {
    issues.push('NEXT_PUBLIC_SUPABASE_URL is not a valid URL')
  }
  if (privateUrl && !isValidSupabaseUrl(privateUrl)) {
    issues.push('SUPABASE_URL is not a valid URL')
  }
  if (publicUrl && privateUrl && publicUrl !== privateUrl) {
    issues.push('SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL should match')
  }
  if (anon && service && anon === service) {
    issues.push('Anon key and service role key must be different')
  }

  console.log('Supabase config snapshot:')
  console.log(`- NEXT_PUBLIC_SUPABASE_URL: ${mask(publicUrl)}`)
  console.log(`- SUPABASE_URL: ${mask(privateUrl)}`)
  console.log(`- NEXT_PUBLIC_SUPABASE_ANON_KEY: ${mask(anon)}`)
  console.log(`- SUPABASE_SERVICE_ROLE_KEY: ${mask(service)}`)

  if (issues.length > 0) {
    console.error('\nSupabase config issues:')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    process.exit(1)
  }

  if (wantsPing) {
    try {
      await maybePing(publicUrl || privateUrl, anon)
      console.log('\nSupabase ping: OK')
    } catch (error) {
      console.error('\nSupabase ping failed:')
      console.error(`- ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  } else {
    console.log('\nSupabase config: OK')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
