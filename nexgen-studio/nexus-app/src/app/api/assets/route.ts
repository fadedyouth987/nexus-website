import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError } from '@/server/api/route'
import { getAssets } from '@/modules/assets'

export async function GET() {
  try {
    const session = await requireAppSession()
    const assets = await getAssets(session)
    return NextResponse.json({ items: assets })
  } catch (error) {
    return handleRouteError(error)
  }
}
