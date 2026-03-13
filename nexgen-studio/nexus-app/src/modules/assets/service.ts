import type { AppSession } from '@/server/auth/session'
import { listAssets } from './repository'

export async function getAssets(session: AppSession) {
  return listAssets(session)
}
