import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { createClient } from '@/lib/supabase/server'

function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this'
}

async function getUserId(request: Request) {
  const token = await getToken({ req: request as any, secret: getAuthSecret() })
  return typeof token?.id === 'string' ? token.id : null
}

function getId(params: { params: Promise<{ id: string }> }) {
  return params.params.then(({ id }) => id)
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const id = await getId(context)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('creators')
    .select('id, name, handle, niche, bio, style_template, vault_mode, status, created_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ detail: 'Failed to load creator' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ detail: 'Creator not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  for (const key of ['name', 'niche', 'bio', 'style_template', 'status']) {
    const value = body[key]
    if (typeof value === 'string') {
      updates[key] = value.trim()
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ detail: 'No valid creator fields provided' }, { status: 400 })
  }

  const id = await getId(context)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('creators')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select('id, name, handle, niche, bio, style_template, vault_mode, status, created_at')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ detail: 'Failed to update creator' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ detail: 'Creator not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const id = await getId(context)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('creators')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    return NextResponse.json({ detail: 'Failed to delete creator' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ detail: 'Creator not found' }, { status: 404 })
  }

  return new NextResponse(null, { status: 204 })
}
