import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { publishDueSchedules } from '../../../../../../server/worker/processors/publishScheduledContent'

export const runtime = 'nodejs'

function parseLimit(value: string | null): number {
  const parsed = Number(value || '')
  if (!Number.isFinite(parsed)) return 25
  return Math.min(100, Math.max(1, Math.floor(parsed)))
}

function hasPublishConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

export async function POST(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  if (!hasPublishConfig()) {
    return NextResponse.json({
      dispatched: 0,
      skipped: 0,
      queueEnabled: false,
      detail: 'Dispatch disabled: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    })
  }

  const { searchParams } = new URL(request.url)
  const limit = parseLimit(searchParams.get('limit'))

  try {
    const result = await publishDueSchedules(limit)
    return NextResponse.json({
      dispatched: result.processed || 0,
      skipped: 0,
      queueEnabled: true,
    })
  } catch (error) {
    return NextResponse.json(
      {
        detail: error instanceof Error ? error.message : 'Failed to dispatch scheduled posts',
      },
      { status: 500 }
    )
  }
}
