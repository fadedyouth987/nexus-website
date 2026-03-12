/**
 * Upload ComfyUI outputs to the configured S3-compatible network storage
 * and return signed URLs for immediate access.
 */

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requireEnv } from '@/lib/blueprint/env'

const SIGNED_URL_EXPIRY_SEC = 3600

export interface UploadResult {
  storagePath: string
  signedUrl: string
  filename: string
  kind: 'image' | 'video'
}

function getClient(isVault: boolean) {
  return new S3Client({
    endpoint: requireEnv('S3_ENDPOINT'),
    region: process.env.S3_REGION || 'auto',
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv(isVault ? 'S3_VAULT_ACCESS_KEY' : 'S3_ACCESS_KEY'),
      secretAccessKey: requireEnv(isVault ? 'S3_VAULT_SECRET_KEY' : 'S3_SECRET_KEY'),
    },
  })
}

function getBucket(isVault: boolean) {
  return requireEnv(isVault ? 'S3_VAULT_BUCKET' : 'S3_BUCKET')
}

function getContentType(filename: string, kind: 'image' | 'video') {
  if (kind === 'video') return 'video/mp4'
  if (filename.toLowerCase().endsWith('.png')) return 'image/png'
  if (filename.toLowerCase().endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

/**
 * Buckets are expected to exist already in the network storage.
 */
export async function ensureBucket(): Promise<void> {
  return
}

/**
 * Upload a single buffer to network storage and return a signed URL.
 */
export async function uploadOutput(
  pathPrefix: string,
  filename: string,
  buffer: ArrayBuffer,
  kind: 'image' | 'video',
  options?: { isVault?: boolean }
): Promise<UploadResult> {
  const isVault = options?.isVault === true
  const storagePath = `${pathPrefix}/${filename}`.replace(/\/+/g, '/')
  const bucket = getBucket(isVault)
  const client = getClient(isVault)
  const contentType = getContentType(filename, kind)

  const uploadInput = {
    Bucket: bucket,
    Key: storagePath,
    Body: Buffer.from(buffer),
    ContentType: contentType,
  }

  await client.send(new PutObjectCommand(uploadInput))

  const signedUrl = await getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      ResponseContentType: contentType,
    }),
    { expiresIn: SIGNED_URL_EXPIRY_SEC }
  )

  return {
    storagePath,
    signedUrl,
    filename,
    kind,
  }
}

/**
 * Upload multiple assets and return their signed URLs.
 */
export async function uploadOutputs(
  pathPrefix: string,
  assets: Array<{ filename: string; buffer: ArrayBuffer; kind: 'image' | 'video' }>,
  options?: { isVault?: boolean }
): Promise<UploadResult[]> {
  const results: UploadResult[] = []
  for (const asset of assets) {
    const result = await uploadOutput(
      pathPrefix,
      asset.filename,
      asset.buffer,
      asset.kind,
      options
    )
    results.push(result)
  }
  return results
}
