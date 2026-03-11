import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { createClient } from '@/lib/supabase/server'
import { getJob } from '@/lib/blueprint/readModel'

export async function GET(request: Request, { params }: { params: Promise<{ job_id: string }> }) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })
  const userId = typeof token?.id === 'string' ? token.id : null

  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { job_id } = await params
  const supabase = await createClient()
  let data
  try {
    data = await getJob({ supabase, userId, jobId: job_id })
  } catch {
    return NextResponse.json({ detail: 'Failed to load job' }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ detail: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: data.id,
    status:
      data.status === 'queued'
        ? 'PENDING'
        : data.status === 'pending'
          ? 'PENDING'
        : data.status === 'in_progress'
          ? 'IN_PROGRESS'
          : data.status === 'generating'
          ? 'IN_PROGRESS'
        : data.status === 'completed'
          ? 'SUCCEEDED'
          : data.status === 'ready'
          ? 'SUCCEEDED'
        : data.status === 'failed'
          ? 'FAILED'
          : String(data.status).toUpperCase(),
    error_message: data.error_message || null,
    result: data.result || {
      asset_id: null,
      image_path: null,
      video_path: null,
    },
  })
}
