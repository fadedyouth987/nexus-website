import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError, parseJsonBody } from '@/server/api/route'
import {
  getScheduledContentRun,
  updateScheduledContentRunRecord,
  updateScheduledContentRunSchema,
} from '@/modules/scheduling'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await requireAppSession()
    const { id } = await context.params
    const detail = await getScheduledContentRun(session, id)
    return NextResponse.json(detail)
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await requireAppSession()
    const { id } = await context.params
    const payload = await parseJsonBody(request, updateScheduledContentRunSchema)
    const result = await updateScheduledContentRunRecord(session, id, payload)
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
