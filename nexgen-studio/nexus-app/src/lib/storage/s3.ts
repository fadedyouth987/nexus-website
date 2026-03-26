import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function buildClient(): S3Client {
  const region = process.env.AWS_REGION || 'us-east-1'
  const endpoint = process.env.AWS_ENDPOINT_URL

  return new S3Client({
    region,
    ...(endpoint
      ? {
          endpoint,
          forcePathStyle: true,
        }
      : {}),
    credentials:
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          }
        : undefined,
  })
}

const bucket = () => process.env.S3_BUCKET_NAME || 'nexus-assets'

function publicObjectUrl(key: string): string {
  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, '')
  if (base) {
    return `${base}/${key.replace(/^\//, '')}`
  }
  const endpoint = process.env.AWS_ENDPOINT_URL?.replace(/\/$/, '')
  const b = bucket()
  if (endpoint) {
    return `${endpoint}/${b}/${key.replace(/^\//, '')}`
  }
  const region = process.env.AWS_REGION || 'us-east-1'
  return `https://${b}.s3.${region}.amazonaws.com/${key.replace(/^\//, '')}`
}

export async function uploadToStorage(
  buffer: Buffer,
  key: string,
  contentType: string = 'image/png'
): Promise<string> {
  const client = buildClient()
  const b = bucket()
  await client.send(
    new PutObjectCommand({
      Bucket: b,
      Key: key.replace(/^\//, ''),
      Body: buffer,
      ContentType: contentType,
    })
  )
  return publicObjectUrl(key)
}

export async function getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const client = buildClient()
  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key.replace(/^\//, ''),
  })
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds })
}

export async function deleteFromStorage(key: string): Promise<void> {
  const client = buildClient()
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket(),
      Key: key.replace(/^\//, ''),
    })
  )
}
