import type { AppSession } from '@/server/auth/session'
import { createCampaign, getCampaignById, listCampaigns, updateCampaign } from './repository'
import type { CreateCampaignInput, UpdateCampaignInput } from './types'

export async function getCampaigns(session: AppSession) {
  return listCampaigns(session)
}

export async function createCampaignRecord(session: AppSession, input: CreateCampaignInput) {
  return createCampaign(session, input)
}

export async function getCampaign(session: AppSession, campaignId: string) {
  return getCampaignById(session, campaignId)
}

export async function updateCampaignRecord(
  session: AppSession,
  campaignId: string,
  input: UpdateCampaignInput
) {
  return updateCampaign(session, campaignId, input)
}
