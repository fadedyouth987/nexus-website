import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError, parseJsonBody } from '@/server/api/route'
import { getVideoJobById, updateVideoJobRecord, updateVideoJobSchema } from '@/modules/video-jobs'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAppSession()
    const { id } = await context.params
    const job = await getVideoJobById(session, id)
    return NextResponse.json(job)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAppSession()
    const { id } = await context.params
    const payload = await parseJsonBody(request, updateVideoJobSchema)
    const job = await updateVideoJobRecord(session, id, payload)
    return NextResponse.json(job)
  } catch (error) {
    return handleRouteError(error)
  }
}
