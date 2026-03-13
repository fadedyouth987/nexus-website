import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getBlueprintSupabaseAdmin } from '../../../src/lib/blueprint/supabaseAdmin'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

const SUPABASE_STANDARD_BUCKET = 'assets'

function hasS3StorageConfig(isVault: boolean) {
  const requiredNames = isVault
    ? ['S3_ENDPOINT', 'S3_VAULT_BUCKET', 'S3_VAULT_ACCESS_KEY', 'S3_VAULT_SECRET_KEY']
    : ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']

  return requiredNames.every((name) => Boolean(process.env[name]))
}

function client(isVault: boolean) {
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

export async function uploadObject(opts: {
  key: string
  body: Buffer
  contentType: string
  isVault: boolean
}) {
  if (!hasS3StorageConfig(opts.isVault)) {
    if (opts.isVault) {
      throw new Error('Vault storage requires S3 configuration')
    }

    const admin = getBlueprintSupabaseAdmin()
    const { error } = await admin.storage
      .from(SUPABASE_STANDARD_BUCKET)
      .upload(opts.key, opts.body, {
        contentType: opts.contentType,
        upsert: true,
      })

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`)
    }

    return opts.key
  }

  const bucket = requireEnv(opts.isVault ? 'S3_VAULT_BUCKET' : 'S3_BUCKET')
  await client(opts.isVault).send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: opts.key,
      Body: opts.body,
      ContentType: opts.contentType,
    })
  )
  return opts.key
}
