import { createServiceClient } from '@/lib/supabase/service'

export type ModerationStatus = 'pending' | 'approved' | 'flagged' | 'rejected'
export type SafetyRating = 'safe' | 'suggestive' | 'explicit' | 'unknown'

export interface ModerationResult {
  assetId: string
  status: ModerationStatus
  safetyRating: SafetyRating
  provider: string
  scores: Record<string, number>
}

export async function createModerationRecord(
  assetId: string,
  orgId: string,
  jobId: string
): Promise<string> {
  const service = createServiceClient()

  const { data } = await service
    .from('content_moderation')
    .insert({
      asset_id: assetId,
      org_id: orgId,
      job_id: jobId,
      status: 'pending',
      safety_rating: 'unknown',
    })
    .select('id')
    .single()

  if (!data) {
    throw new Error('Failed to create moderation record')
  }

  return data.id
}

export async function moderateAsset(
  assetId: string,
  orgId: string,
  jobId: string,
  options?: {
    provider?: 'nsfw_api' | 'clarifai' | 'manual'
    apiKey?: string
  }
): Promise<ModerationResult> {
  const provider = options?.provider ?? 'nsfw_api'
  const apiKey = options?.apiKey ?? process.env.NSFW_DETECTION_API_KEY ?? process.env.CLARIFAI_API_KEY

  if (!apiKey) {
    // Auto-approve if no moderation API is configured
    return autoApproveModeration(assetId, orgId, jobId)
  }

  try {
    const { data: asset } = await createServiceClient()
      .from('generated_assets')
      .select('url')
      .eq('id', assetId)
      .single()

    if (!asset?.url) {
      throw new Error(`Asset ${assetId} not found`)
    }

    let result: ModerationResult

    if (provider === 'nsfw_api') {
      result = await moderateWithNSFWApi(asset.url, apiKey, assetId, orgId, jobId)
    } else if (provider === 'clarifai') {
      result = await moderateWithClarifai(asset.url, apiKey, assetId, orgId, jobId)
    } else {
      result = await autoApproveModeration(assetId, orgId, jobId)
    }

    // Update moderation record
    const service = createServiceClient()
    await service
      .from('content_moderation')
      .update({
        status: result.status,
        safety_rating: result.safetyRating,
        moderation_provider: result.provider,
        moderation_scores: result.scores,
      })
      .eq('asset_id', assetId)

    // Update asset record
    await service
      .from('generated_assets')
      .update({
        safety_rating: result.safetyRating,
        moderation_status: result.status === 'approved' ? 'approved' : result.status === 'rejected' ? 'rejected' : 'flagged',
      })
      .eq('id', assetId)

    return result
  } catch (error) {
    console.error('[moderation] failed to moderate asset:', error)
    return autoApproveModeration(assetId, orgId, jobId)
  }
}

async function moderateWithNSFWApi(
  imageUrl: string,
  apiKey: string,
  assetId: string,
  orgId: string,
  jobId: string
): Promise<ModerationResult> {
  const response = await fetch('https://api.nsfwjs.com/v2/predict', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url: imageUrl }),
  })

  if (!response.ok) {
    throw new Error(`NSFW API request failed: ${response.status}`)
  }

  const data = await response.json() as { predictions: Record<string, number> }
  const scores = data.predictions ?? {}

  const explicitScore = scores.explicit ?? 0
  const suggestiveScore = scores.suggestive ?? 0
  const safeScore = scores.neutral ?? scores.drawings ?? 0

  let safetyRating: SafetyRating = 'safe'
  let status: ModerationStatus = 'approved'

  if (explicitScore > 0.7) {
    safetyRating = 'explicit'
    status = 'rejected'
  } else if (suggestiveScore > 0.6) {
    safetyRating = 'suggestive'
    status = 'flagged'
  }

  return {
    assetId,
    status,
    safetyRating,
    provider: 'nsfw_api',
    scores,
  }
}

async function moderateWithClarifai(
  imageUrl: string,
  apiKey: string,
  assetId: string,
  orgId: string,
  jobId: string
): Promise<ModerationResult> {
  const response = await fetch('https://api.clarifai.com/v2/models/moderation/recognition/outputs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify({
      inputs: [{ data: { image: { url: imageUrl } } }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Clarifai API request failed: ${response.status}`)
  }

  const data = await response.json() as {
    outputs: Array<{
      data: {
        concepts: Array<{ name: string; value: number }>
      }
    }>
  }

  const concepts = data.outputs?.[0]?.data?.concepts ?? []
  const scores: Record<string, number> = {}
  concepts.forEach(c => { scores[c.name] = c.value })

  const explicitScore = scores['explicit'] ?? 0
  const suggestiveScore = scores['suggestive'] ?? 0

  let safetyRating: SafetyRating = 'safe'
  let status: ModerationStatus = 'approved'

  if (explicitScore > 0.7) {
    safetyRating = 'explicit'
    status = 'rejected'
  } else if (suggestiveScore > 0.6) {
    safetyRating = 'suggestive'
    status = 'flagged'
  }

  return {
    assetId,
    status,
    safetyRating,
    provider: 'clarifai',
    scores,
  }
}

async function autoApproveModeration(
  assetId: string,
  orgId: string,
  jobId: string
): Promise<ModerationResult> {
  return {
    assetId,
    status: 'approved',
    safetyRating: 'safe',
    provider: 'auto_approve',
    scores: {},
  }
}

export async function getPendingModerations(orgId: string, limit: number = 50): Promise<Array<{
  id: string
  asset_id: string
  org_id: string
  job_id: string
  status: string
  safety_rating: string
  created_at: string
}>> {
  const service = createServiceClient()

  const { data } = await service
    .from('content_moderation')
    .select('id, asset_id, org_id, job_id, status, safety_rating, created_at')
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit)

  return data ?? []
}

export async function reviewModeration(
  moderationId: string,
  reviewerId: string,
  status: ModerationStatus,
  safetyRating: SafetyRating
): Promise<void> {
  const service = createServiceClient()

  const { data: moderation } = await service
    .from('content_moderation')
    .select('asset_id')
    .eq('id', moderationId)
    .single()

  if (!moderation?.asset_id) {
    throw new Error(`Moderation record ${moderationId} not found`)
  }

  await service
    .from('content_moderation')
    .update({
      status,
      safety_rating: safetyRating,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', moderationId)

  await service
    .from('generated_assets')
    .update({
      safety_rating: safetyRating,
      moderation_status: status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'flagged',
    })
    .eq('id', moderation.asset_id)
}
