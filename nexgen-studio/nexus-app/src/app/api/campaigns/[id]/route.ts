import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError, parseJsonBody } from '@/server/api/route'
import { getCampaign, updateCampaignRecord, updateCampaignSchema } from '@/modules/campaigns'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAppSession()
    const { id } = await context.params
    const campaign = await getCampaign(session, id)
    if (!campaign) {
      return NextResponse.json({ detail: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json(campaign)
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
    const payload = await parseJsonBody(request, updateCampaignSchema)
    const campaign = await updateCampaignRecord(session, id, payload)
    return NextResponse.json(campaign)
  } catch (error) {
    return handleRouteError(error)
  }
}
