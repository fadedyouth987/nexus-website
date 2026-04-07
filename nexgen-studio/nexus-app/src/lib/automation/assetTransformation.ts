import { createServiceClient } from '@/lib/supabase/service'
import { uploadToStorage, getSignedDownloadUrl } from '@/lib/storage'

export type TransformationType = 'thumbnail' | 'resize' | 'format_convert' | 'optimize'

export interface TransformationConfig {
  width?: number
  height?: number
  format?: 'webp' | 'jpeg' | 'png'
  quality?: number
  maxSize?: number // in bytes
}

export async function createTransformationRecord(
  sourceAssetId: string,
  orgId: string,
  transformationType: TransformationType,
  config: TransformationConfig
): Promise<string> {
  const service = createServiceClient()

  const { data } = await service
    .from('asset_transformations')
    .insert({
      source_asset_id: sourceAssetId,
      org_id: orgId,
      transformation_type: transformationType,
      status: 'pending',
      input_params: config,
    })
    .select('id')
    .single()

  if (!data) {
    throw new Error('Failed to create transformation record')
  }

  return data.id
}

export async function processTransformation(transformationId: string): Promise<{
  success: boolean
  outputUrl?: string
  error?: string
}> {
  const service = createServiceClient()

  const { data: transformation, error: fetchError } = await service
    .from('asset_transformations')
    .select(`
      *,
      source_asset:generated_assets (
        url,
        file_type,
        width,
        height
      )
    `)
    .eq('id', transformationId)
    .single()

  if (fetchError || !transformation) {
    return { success: false, error: 'Transformation not found' }
  }

  const sourceAsset = transformation.source_asset as any
  if (!sourceAsset?.url) {
    return { success: false, error: 'Source asset not found' }
  }

  await service
    .from('asset_transformations')
    .update({ status: 'processing' })
    .eq('id', transformationId)

  try {
    const config = (transformation.input_params ?? {}) as TransformationConfig
    const sourceUrl = sourceAsset.url
    const sourceType = sourceAsset.file_type ?? 'image/png'

    // Fetch the source image
    const response = await fetch(sourceUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch source image: ${response.status}`)
    }

    const imageBuffer = Buffer.from(await response.arrayBuffer())

    // Apply transformation
    let transformedBuffer: Buffer
    let outputType: string
    let outputKey: string

    switch (transformation.transformation_type) {
      case 'thumbnail':
        transformedBuffer = await generateThumbnail(imageBuffer, config)
        outputType = 'image/webp'
        outputKey = `thumbnails/${transformation.org_id}/${transformation.source_asset_id}.webp`
        break

      case 'resize':
        transformedBuffer = await resizeImage(imageBuffer, config)
        outputType = sourceType
        outputKey = `resized/${transformation.org_id}/${transformation.source_asset_id}_${config.width}x${config.height}.${sourceType.split('/')[1]}`
        break

      case 'format_convert':
        transformedBuffer = await convertFormat(imageBuffer, config)
        outputType = `image/${config.format ?? 'webp'}`
        outputKey = `converted/${transformation.org_id}/${transformation.source_asset_id}.${config.format ?? 'webp'}`
        break

      case 'optimize':
        transformedBuffer = await optimizeImage(imageBuffer, config)
        outputType = sourceType
        outputKey = `optimized/${transformation.org_id}/${transformation.source_asset_id}.${sourceType.split('/')[1]}`
        break

      default:
        throw new Error(`Unknown transformation type: ${transformation.transformation_type}`)
    }

    // Upload transformed image
    const outputUrl = await uploadToStorage(transformedBuffer, outputKey, outputType)

    // Update transformation record
    await service
      .from('asset_transformations')
      .update({
        status: 'completed',
        output_url: outputUrl,
        completed_at: new Date().toISOString(),
      })
      .eq('id', transformationId)

    return { success: true, outputUrl }
  } catch (error: any) {
    console.error('[transformation] failed:', error)

    await service
      .from('asset_transformations')
      .update({
        status: 'failed',
        error_message: error.message ?? 'Unknown error',
      })
      .eq('id', transformationId)

    return { success: false, error: error.message ?? 'Unknown error' }
  }
}

async function generateThumbnail(buffer: Buffer, config: TransformationConfig): Promise<Buffer> {
  // In production, use sharp library for image processing
  // For now, return the original buffer (placeholder)
  // const sharp = require('sharp')
  // return sharp(buffer).resize(256, 256, { fit: 'cover' }).webp().toBuffer()
  console.warn('[transformation] thumbnail generation using placeholder - install sharp for production')
  return buffer
}

async function resizeImage(buffer: Buffer, config: TransformationConfig): Promise<Buffer> {
  // In production, use sharp library
  // const sharp = require('sharp')
  // return sharp(buffer).resize(config.width, config.height, { fit: 'inside' }).toBuffer()
  console.warn('[transformation] resize using placeholder - install sharp for production')
  return buffer
}

async function convertFormat(buffer: Buffer, config: TransformationConfig): Promise<Buffer> {
  // In production, use sharp library
  // const sharp = require('sharp')
  // const format = config.format ?? 'webp'
  // return sharp(buffer)[format]({ quality: config.quality ?? 80 }).toBuffer()
  console.warn('[transformation] format conversion using placeholder - install sharp for production')
  return buffer
}

async function optimizeImage(buffer: Buffer, config: TransformationConfig): Promise<Buffer> {
  // In production, use sharp library
  // const sharp = require('sharp')
  // return sharp(buffer).webp({ quality: config.quality ?? 80 }).toBuffer()
  console.warn('[transformation] optimization using placeholder - install sharp for production')
  return buffer
}

export async function generateThumbnailForAsset(assetId: string, orgId: string): Promise<string | null> {
  const service = createServiceClient()

  // Check if thumbnail already exists
  const { data: existing } = await service
    .from('asset_transformations')
    .select('output_url')
    .eq('source_asset_id', assetId)
    .eq('transformation_type', 'thumbnail')
    .eq('status', 'completed')
    .single()

  if (existing?.output_url) {
    return existing.output_url
  }

  // Create and process transformation
  const transformationId = await createTransformationRecord(
    assetId,
    orgId,
    'thumbnail',
    { width: 256, height: 256, format: 'webp', quality: 80 }
  )

  const result = await processTransformation(transformationId)

  if (result.success && result.outputUrl) {
    // Update asset with thumbnail URL
    await service
      .from('generated_assets')
      .update({ thumbnail_url: result.outputUrl })
      .eq('id', assetId)

    return result.outputUrl
  }

  return null
}

export async function getTransformationsForAsset(assetId: string): Promise<Array<{
  id: string
  transformation_type: string
  status: string
  output_url: string | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}>> {
  const service = createServiceClient()

  const { data } = await service
    .from('asset_transformations')
    .select('id, transformation_type, status, output_url, error_message, created_at, completed_at')
    .eq('source_asset_id', assetId)
    .order('created_at', { ascending: false })

  return data ?? []
}

export async function processPendingTransformations(): Promise<void> {
  const service = createServiceClient()

  const { data: pending, error } = await service
    .from('asset_transformations')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20)

  if (error || !pending?.length) return

  for (const item of pending) {
    await processTransformation(item.id)
  }
}
