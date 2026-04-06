import type { AppSession } from '@/server/auth/session'
import { createBrandKit, getBrandKitById, listBrandKits, updateBrandKit } from './repository'
import type { CreateBrandKitInput } from './types'

export async function getBrandKits(session: AppSession) {
  return listBrandKits(session)
}

export async function createBrandKitRecord(session: AppSession, input: CreateBrandKitInput) {
  return createBrandKit(session, input)
}

export async function getBrandKit(session: AppSession, brandKitId: string) {
  return getBrandKitById(session, brandKitId)
}

export async function updateBrandKitRecord(session: AppSession, brandKitId: string, input: CreateBrandKitInput) {
  return updateBrandKit(session, brandKitId, input)
}
