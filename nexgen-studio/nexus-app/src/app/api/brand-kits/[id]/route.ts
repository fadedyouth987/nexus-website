import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError, parseJsonBody } from '@/server/api/route'
import { getBrandKit, updateBrandKitRecord, updateBrandKitSchema } from '@/modules/brand-kits'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAppSession()
    const { id } = await context.params
    const brandKit = await getBrandKit(session, id)
    if (!brandKit) {
      return NextResponse.json({ detail: 'Brand kit not found' }, { status: 404 })
    }
    return NextResponse.json(brandKit)
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
    const payload = await parseJsonBody(request, updateBrandKitSchema)
    const brandKit = await updateBrandKitRecord(session, id, payload)
    return NextResponse.json(brandKit)
  } catch (error) {
    return handleRouteError(error)
  }
}
