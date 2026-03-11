/**
 * Upload ComfyUI outputs to Supabase Storage and return signed URLs.
 */

import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

const BUCKET = process.env.COMFYUI_OUTPUT_BUCKET ?? 'comfy-outputs'
const SIGNED_URL_EXPIRY_SEC = 3600

export interface UploadResult {
  storagePath: string
  signedUrl: string
  filename: string
  kind: 'image' | 'video'
}

/**
 * Ensure the bucket exists (call once at startup or ignore if using existing bucket).
 */
export async function ensureBucket(): Promise<void> {
  const admin = getEngineSupabaseAdmin()
  const { data: buckets } = await admin.storage.listBuckets()
  if (buckets?.some((b: { name: string }) => b.name === BUCKET)) return
  await admin.storage.createBucket(BUCKET, { public: false })
}

/**
 * Upload a single buffer to Supabase Storage and return the signed URL.
 */
export async function uploadOutput(
  pathPrefix: string,
  filename: string,
  buffer: ArrayBuffer,
  kind: 'image' | 'video'
): Promise<UploadResult> {
  const admin = getEngineSupabaseAdmin()
  const storagePath = `${pathPrefix}/${filename}`.replace(/\/+/g, '/')
  const contentType =
    kind === 'video'
      ? 'video/mp4'
      : filename.toLowerCase().endsWith('.png')
        ? 'image/png'
        : 'image/jpeg'

  const { error } = await admin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType,
    upsert: true,
  })

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`)
  }

  const { data: signed, error: signError } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SEC)

  if (signError || !signed?.signedUrl) {
    throw new Error(signError?.message ?? 'Failed to create signed URL')
  }

  return {
    storagePath,
    signedUrl: signed.signedUrl,
    filename,
    kind,
  }
}

/**
 * Upload multiple assets and return their signed URLs.
 */
export async function uploadOutputs(
  pathPrefix: string,
  assets: Array<{ filename: string; buffer: ArrayBuffer; kind: 'image' | 'video' }>
): Promise<UploadResult[]> {
  const results: UploadResult[] = []
  for (const asset of assets) {
    const result = await uploadOutput(
      pathPrefix,
      asset.filename,
      asset.buffer,
      asset.kind
    )
    results.push(result)
  }
  return results
}
