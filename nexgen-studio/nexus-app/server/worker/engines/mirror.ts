import { mirrorGeneratedAssetToLegacy, mirrorJobStatusToLegacy } from '../../../src/lib/blueprint/compat/mirrorToLegacy'

/**
 * Mirror an asset to legacy tables - fire-and-forget async
 * This is a best-effort mirror; failures are logged but don't block
 */
export function mirrorAsset(admin: any, job: any, asset: any) {
  // Fire-and-forget: don't await, don't block worker
  mirrorGeneratedAssetToLegacy({ admin, job, asset }).catch((err) => {
    console.error('[mirrorAsset] Failed:', err instanceof Error ? err.message : String(err))
  })
}

/**
 * Mirror job status to legacy tables - fire-and-forget async
 * generation_jobs is the SOURCE OF TRUTH
 * legacy.generations is a READ MIRROR only
 * This is a best-effort mirror; failures are logged but don't block
 */
export function mirrorJobStatus(admin: any, job: any) {
  // Fire-and-forget: don't await, don't block worker
  mirrorJobStatusToLegacy({ admin, job }).catch((err) => {
    console.error('[mirrorJobStatus] Failed:', err instanceof Error ? err.message : String(err))
  })
}
