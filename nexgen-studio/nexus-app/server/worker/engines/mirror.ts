import { mirrorGeneratedAssetToLegacy, mirrorJobStatusToLegacy } from '../../../src/lib/blueprint/compat/mirrorToLegacy'

export async function mirrorAsset(admin: any, job: any, asset: any) {
  await mirrorGeneratedAssetToLegacy({ admin, job, asset })
}

export async function mirrorJobStatus(admin: any, job: any) {
  await mirrorJobStatusToLegacy({ admin, job })
}
