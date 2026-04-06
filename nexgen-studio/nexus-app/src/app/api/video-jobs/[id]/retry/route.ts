import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError } from '@/server/api/route'
import { retryVideoJob } from '@/modules/video-jobs'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAppSession()
    const { id } = await context.params
    const job = await retryVideoJob(session, id)
    return NextResponse.json(job)
  } catch (error) {
    return handleRouteError(error)
  }
}
