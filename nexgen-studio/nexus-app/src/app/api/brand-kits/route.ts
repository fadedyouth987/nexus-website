import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError, parseJsonBody } from '@/server/api/route'
import { createBrandKitRecord, createBrandKitSchema, getBrandKits } from '@/modules/brand-kits'

export async function GET() {
  try {
    const session = await requireAppSession()
    const brandKits = await getBrandKits(session)
    return NextResponse.json({ items: brandKits })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession()
    const payload = await parseJsonBody(request, createBrandKitSchema)
    const brandKit = await createBrandKitRecord(session, payload)
    return NextResponse.json(brandKit, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
