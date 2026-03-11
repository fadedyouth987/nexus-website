import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
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
