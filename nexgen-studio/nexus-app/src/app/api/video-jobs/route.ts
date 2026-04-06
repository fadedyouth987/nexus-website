import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError, parseJsonBody } from '@/server/api/route'
import { createVideoJobRecord, createVideoJobSchema, getVideoJobs } from '@/modules/video-jobs'

export async function GET() {
  try {
    const session = await requireAppSession()
    const jobs = await getVideoJobs(session)
    return NextResponse.json({ items: jobs })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession()
    const payload = await parseJsonBody(request, createVideoJobSchema)
    const result = await createVideoJobRecord(session, payload)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
