import { requireEnv } from './env'

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
