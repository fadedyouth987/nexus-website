import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { vaultEnabled, canUseNSFW } from '@/lib/blueprint/entitlements'
import { getBlueprintSignedGetUrl } from '@/lib/blueprint/storageSign'
import { getBlueprintSupabaseAdmin } from '@/lib/blueprint/supabaseAdmin'
import { writeBlueprintAudit } from '@/lib/blueprint/audit'

export async function GET(
  request: Request,
  context: { params: Promise<{ assetId: string }> }
) {
  try {
    const { authUserId, profile } = await requireBlueprintUser(request)
    const { assetId } = await context.params
    const admin = getBlueprintSupabaseAdmin()

    const { data: asset } = await admin
      .from('generated_assets')
      .select('*')
      .eq('id', assetId)
      .maybeSingle()

    if (!asset) {
      return NextResponse.json({ detail: 'Asset not found' }, { status: 404 })
    }

    const { data: job } = await admin
      .from('generation_jobs')
      .select('id, user_id')
      .eq('id', asset.generation_job_id)
      .maybeSingle()

    if (!job || job.user_id !== authUserId) {
      return NextResponse.json({ detail: 'Asset not found' }, { status: 404 })
    }

    if (asset.visibility === 'VAULT' && (!vaultEnabled(profile) || !canUseNSFW(profile))) {
      return NextResponse.json({ detail: 'Vault access denied' }, { status: 403 })
    }

    const signed = await getBlueprintSignedGetUrl({
      key: asset.storage_url,
      isVault: asset.visibility === 'VAULT',
    })

    await writeBlueprintAudit(authUserId, 'ASSET_SIGNED_URL', 'GeneratedAsset', asset.id, {
      visibility: asset.visibility,
    })

    return NextResponse.json(signed)
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to sign asset URL' },
      { status }
    )
  }
}
