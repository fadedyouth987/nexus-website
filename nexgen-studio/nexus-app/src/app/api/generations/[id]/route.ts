import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { createClient } from '@/lib/supabase/server'
import { getJob } from '@/lib/blueprint/readModel'

function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this'
}

async function getUserId(request: Request) {
  const token = await getToken({ req: request as any, secret: getAuthSecret() })
  return typeof token?.id === 'string' ? token.id : null
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await context.params
  const supabase = await createClient()
  let data
  try {
    data = await getJob({ supabase, userId, jobId: id })
  } catch {
    return NextResponse.json({ detail: 'Failed to load generation' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ detail: 'Generation not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
