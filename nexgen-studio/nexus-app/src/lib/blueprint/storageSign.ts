import { requireEnv } from './env'
import { getBlueprintSupabaseAdmin } from './supabaseAdmin'

const SUPABASE_STANDARD_BUCKET = 'assets'

function hasS3StorageConfig(isVault: boolean) {
  const requiredNames = isVault
    ? ['S3_ENDPOINT', 'S3_VAULT_BUCKET', 'S3_VAULT_ACCESS_KEY', 'S3_VAULT_SECRET_KEY']
    : ['S3_ENDPOINT', 'S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY']

  return requiredNames.every((name) => Boolean(process.env[name]))
}

function loadAwsSdk() {
  const req = eval('require') as NodeRequire
  return {
    ...req('@aws-sdk/client-s3'),
    getSignedUrl: req('@aws-sdk/s3-request-presigner').getSignedUrl,
  }
}

function getClient(isVault: boolean) {
  const { S3Client } = loadAwsSdk()
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

export async function getBlueprintSignedGetUrl(opts: { key: string; isVault: boolean }) {
  if (!hasS3StorageConfig(opts.isVault)) {
    if (opts.isVault) {
      throw new Error('Vault storage requires S3 configuration')
    }

    const admin = getBlueprintSupabaseAdmin()
    const expiresIn = 120
    const { data, error } = await admin.storage
      .from(SUPABASE_STANDARD_BUCKET)
      .createSignedUrl(opts.key, expiresIn)

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || 'Failed to sign asset URL from Supabase Storage')
    }

    return {
      signedUrl: data.signedUrl,
      expiresAt: Date.now() + expiresIn * 1000,
    }
  }

  const { GetObjectCommand, getSignedUrl } = loadAwsSdk()
  const expiresIn = opts.isVault ? 60 : 120
  const bucket = requireEnv(opts.isVault ? 'S3_VAULT_BUCKET' : 'S3_BUCKET')
  const signedUrl = await getSignedUrl(
    getClient(opts.isVault),
    new GetObjectCommand({ Bucket: bucket, Key: opts.key }),
    { expiresIn }
  )

  return {
    signedUrl,
    expiresAt: Date.now() + expiresIn * 1000,
  }
}
