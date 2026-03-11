import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import type { CreatorResult, FactoryPersonaInput } from '@/lib/automation/pipeline/types'
import { createLegacyCreator, getLegacyCreatorById } from './legacyAdapter'
import { createV2Creator, getV2CreatorById, resolveV2CreatorContext } from './v2Adapter'

export type CreatorRecord = {
  id: string
  mode: 'legacy' | 'v2'
  orgId?: string
  workspaceId?: string
  name?: string
  handle?: string
  niche?: string
  status?: string
}

export type CreateCreatorInput = {
  persona: FactoryPersonaInput
}

export interface CreatorService {
  create(input: CreateCreatorInput): Promise<CreatorResult>
  getById(id: string): Promise<CreatorRecord | null>
}

function buildHandle(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return (normalized || `creator_${Date.now()}`).slice(0, 40)
}

export function getCreatorService(userId: string): CreatorService {
  const admin = getEngineSupabaseAdmin()

  return {
    async create(input) {
      const persona = input.persona || {}
      const name = String(persona.name || '').trim()
      const handle = buildHandle(name)

      const v2Context = await resolveV2CreatorContext(admin, userId)
      if (v2Context) {
        const v2Id = await createV2Creator(admin, userId, v2Context, handle, persona)
        if (v2Id) {
          return {
            id: v2Id,
            mode: 'v2',
            orgId: v2Context.orgId,
            workspaceId: v2Context.workspaceId,
          }
        }
      }

      const legacyId = await createLegacyCreator(admin, userId, handle, persona)
      if (legacyId) {
        return {
          id: legacyId,
          mode: 'legacy',
        }
      }

      return {
        id: '',
        mode: 'none',
      }
    },

    async getById(id) {
      const v2 = await getV2CreatorById(admin, id)
      if (v2) {
        return {
          id: String(v2.id),
          mode: 'v2',
          orgId: String(v2.org_id),
          workspaceId: String(v2.workspace_id),
          name: typeof v2.name === 'string' ? v2.name : undefined,
          handle: typeof v2.handle === 'string' ? v2.handle : undefined,
          niche: typeof v2.niche === 'string' ? v2.niche : undefined,
          status: typeof v2.status === 'string' ? v2.status : undefined,
        }
      }

      const legacy = await getLegacyCreatorById(admin, id)
      if (legacy) {
        return {
          id: String(legacy.id),
          mode: 'legacy',
          name: typeof legacy.name === 'string' ? legacy.name : undefined,
          handle: typeof legacy.handle === 'string' ? legacy.handle : undefined,
          niche: typeof legacy.niche === 'string' ? legacy.niche : undefined,
          status: typeof legacy.status === 'string' ? legacy.status : undefined,
        }
      }

      return null
    },
  }
}
