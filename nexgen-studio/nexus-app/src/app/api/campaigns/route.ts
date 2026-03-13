import { NextResponse } from 'next/server'
import { requireAppSession } from '@/server/auth/session'
import { handleRouteError, parseJsonBody } from '@/server/api/route'
import { createCampaignRecord, createCampaignSchema, getCampaigns } from '@/modules/campaigns'

export async function GET() {
  try {
    const session = await requireAppSession()
    const campaigns = await getCampaigns(session)
    return NextResponse.json({ items: campaigns })
  } catch (error) {
    return handleRouteError(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAppSession()
    const payload = await parseJsonBody(request, createCampaignSchema)
    const campaign = await createCampaignRecord(session, payload)
    return NextResponse.json(campaign, { status: 201 })
  } catch (error) {
    return handleRouteError(error)
  }
}
