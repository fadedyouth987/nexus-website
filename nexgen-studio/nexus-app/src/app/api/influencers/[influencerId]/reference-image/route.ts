import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getBlueprintSupabaseAdmin } from '@/lib/blueprint/supabaseAdmin'

const BUCKET = 'reference-images'
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

async function getUserId(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })
  return typeof token?.id === 'string' ? token.id : null
}

async function verifyAccess(admin: any, userId: string, influencerId: string) {
  const { data: influencer } = await admin
    .from('influencers')
    .select('id, org_id')
    .eq('id', influencerId)
    .maybeSingle()
  if (!influencer) return null

  const { data: member } = await admin
    .from('organization_members')
    .select('id')
    .eq('user_id', userId)
    .eq('org_id', influencer.org_id)
    .maybeSingle()

  return member ? influencer : null
}

export async function POST(
  request: Request,
  context: { params: Promise<{ influencerId: string }> }
) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const { influencerId } = await context.params
  const admin = getBlueprintSupabaseAdmin()
  const influencer = await verifyAccess(admin, userId, influencerId)
  if (!influencer) {
    return NextResponse.json({ detail: 'Influencer not found' }, { status: 404 })
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json(
      { detail: 'Expected multipart/form-data' },
      { status: 400 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ detail: 'Missing "file" field' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { detail: `File too large. Maximum size is ${MAX_SIZE_BYTES / 1024 / 1024}MB` },
      { status: 413 }
    )
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { detail: 'Only JPEG, PNG, and WebP images are allowed' },
      { status: 400 }
    )
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const storageKey = `${influencerId}/reference.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())

  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((b: { name: string }) => b.name === BUCKET)) {
    await admin.storage.createBucket(BUCKET, { public: false })
  }

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storageKey, buffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json(
      { detail: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  const { data: urlData } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(storageKey, 3600)

  await admin
    .from('influencers')
    .update({ reference_image_storage_key: storageKey })
    .eq('id', influencerId)

  return NextResponse.json({
    storageKey,
    signedUrl: urlData?.signedUrl ?? null,
  })
}
