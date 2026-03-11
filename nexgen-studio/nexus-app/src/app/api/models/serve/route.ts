import { NextResponse } from 'next/server'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { MODEL_BUCKET_NSFW, MODEL_BUCKET_SFW } from '@/lib/models/moderation'
import { getServerSupabase, requireUser } from '@/lib/server/v2Access'
import { getUserVerificationLevel } from '@/lib/server/verification'

type ModelRow = {
  id: string
  user_id: string
  file_path: string
  is_nsfw: boolean
  required_verification_level: number
  meta_json: Record<string, unknown> | null
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const supabase = await getServerSupabase(request)
    const admin = getEngineSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')?.trim() || ''
    const filePath = searchParams.get('file_path')?.trim() || ''

    if (!id && !filePath) {
      return NextResponse.json({ detail: 'id or file_path is required' }, { status: 400 })
    }

    let query = supabase
      .from('models')
      .select('id, user_id, file_path, is_nsfw, required_verification_level, meta_json')
      .limit(1)

    query = id ? query.eq('id', id) : query.eq('file_path', filePath)

    const { data: model, error: modelError } = await query.maybeSingle()
    const typedModel = (model || null) as ModelRow | null
    if (modelError) {
      return NextResponse.json({ detail: modelError.message || 'Failed to load model' }, { status: 500 })
    }
    const verificationLevel = await getUserVerificationLevel(supabase)

    if (!typedModel) {
      // Optional explicit 403 signal when a row exists but viewer level is too low.
      let adminLookup = admin
        .from('models')
        .select('required_verification_level, is_nsfw')
        .limit(1)
      adminLookup = id ? adminLookup.eq('id', id) : adminLookup.eq('file_path', filePath)
      const { data: hidden } = await adminLookup.maybeSingle()
      const hiddenModel = (hidden || null) as { required_verification_level?: number; is_nsfw?: boolean } | null
      if (hiddenModel?.is_nsfw && verificationLevel < Number(hiddenModel.required_verification_level || 0)) {
        return NextResponse.json(
          { detail: 'Age verification required', requiredVerificationLevel: hiddenModel.required_verification_level || 1 },
          { status: 403 }
        )
      }

      return NextResponse.json({ detail: 'Model not found' }, { status: 404 })
    }

    const allowedByVerification =
      !typedModel.is_nsfw || verificationLevel >= Number(typedModel.required_verification_level || 0)
    const allowed = typedModel.user_id === user.userId || allowedByVerification

    if (!allowed) {
      return NextResponse.json(
        { detail: 'Age verification required', requiredVerificationLevel: typedModel.required_verification_level },
        { status: 403 }
      )
    }

    const meta = typedModel.meta_json || {}
    const bucket =
      typeof meta.storage_bucket === 'string' && meta.storage_bucket
        ? meta.storage_bucket
        : typedModel.is_nsfw
          ? MODEL_BUCKET_NSFW
          : MODEL_BUCKET_SFW

    const { data: signed, error: signedError } = await admin.storage
      .from(bucket)
      .createSignedUrl(typedModel.file_path, 60)

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json(
        { detail: signedError?.message || 'Failed to sign model URL' },
        { status: 500 }
      )
    }

    return NextResponse.redirect(signed.signedUrl)
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to serve model' },
      { status }
    )
  }
}
