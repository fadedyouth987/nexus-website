import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError } from '@/server/api/route'
import { resumeScheduledContentRun } from '@/modules/scheduling'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(_: Request, context: RouteContext) {
  try {
    const session = await requireAppSession()
    const { id } = await context.params
    const result = await resumeScheduledContentRun(session, id)
    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
