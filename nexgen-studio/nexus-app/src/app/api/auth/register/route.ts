import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSupabaseAnonKey, requireSupabaseUrl } from '@/lib/supabase/env'

export async function POST(request: Request) {
  let supabase
  try {
    supabase = createClient(requireSupabaseUrl(), requireSupabaseAnonKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  } catch {
    return NextResponse.json({ detail: 'Supabase is not configured' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!email || !password || !name) {
    return NextResponse.json({ detail: 'name, email, and password are required' }, { status: 400 })
  }

  if (password.length < 8) {
    return NextResponse.json({ detail: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  })

  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 400 })
  }

  return NextResponse.json(
    {
      success: true,
      requiresEmailConfirmation: !data.session,
    },
    { status: 201 }
  )
}
