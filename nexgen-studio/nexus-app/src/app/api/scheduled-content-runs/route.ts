import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError, parseJsonBody } from '@/server/api/route'
import {
  createScheduledContentRunRecord,
  createScheduledContentRunSchema,
  getScheduledContentRuns,
} from '@/modules/scheduling'

export async function GET() {
  try {
    const session = await requireAppSession()
    const schedules = await getScheduledContentRuns(session)
    return NextResponse.json({ items: schedules })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession()
    const payload = await parseJsonBody(request, createScheduledContentRunSchema)
    const result = await createScheduledContentRunRecord(session, payload)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
