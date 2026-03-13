import { NextResponse } from 'next/server'
import { handleRouteError } from '@/server/api/route'
import { requireAppSession } from '@/server/auth/session'
import { getGenerationUsageMetrics } from '@/modules/usage-events'

export async function GET(request: Request) {
  try {
    const session = await requireAppSession()
    const { searchParams } = new URL(request.url)
    const result = await getGenerationUsageMetrics(session, {
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    })

    return NextResponse.json(result)
  } catch (error) {
    return handleRouteError(error)
  }
}
