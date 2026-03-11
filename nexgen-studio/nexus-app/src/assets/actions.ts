'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const uploadAssetSchema = z.object({
  influencerId: z.string().uuid(),
  file: z.instanceof(File),
})

export async function saveAsset(influencerId: string, imageUrl: string) {
  // FIX: Just await the client, no need to pass cookies anymore!
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to save an asset.' }
  }

  const { data: influencer, error: influencerError } = await supabase
    .from('influencers')
    .select('org_id')
    .eq('id', influencerId)
    .single()

  if (influencerError || !influencer) {
    return { error: 'Influencer not found.' }
  }

  const { org_id } = influencer

  // Check if user is a member of the organization
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('org_id', org_id)
    .single()

  if (memberError || !member) {
    return { error: 'You are not a member of this organization.' }
  }

  const { error: dbError } = await supabase.from('assets').insert([
    {
      influencer_id: influencerId,
      org_id: org_id,
      url: imageUrl,
      type: 'image',
    },
  ])

  if (dbError) {
    return { error: 'Could not save asset to database.' }
  }

  revalidatePath(`/influencers/${influencerId}`)
}

export async function generateImage(formData: FormData) {
  // FIX: Just await the client!
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to generate an image.' }
  }

  const generateImageSchema = z.object({
    influencerId: z.string().uuid(),
    prompt: z.string().min(1),
  })

  const { influencerId, prompt } = generateImageSchema.parse(
    Object.fromEntries(formData.entries())
  )

  const { data: influencer, error: influencerError } = await supabase
    .from('influencers')
    .select('org_id')
    .eq('id', influencerId)
    .single()

  if (influencerError || !influencer) {
    return { error: 'Influencer not found.' }
  }

  const { org_id } = influencer

  // Check if user is a member of the organization
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('org_id', org_id)
    .single()

  if (memberError || !member) {
    return { error: 'You are not a member of this organization.' }
  }

  return { job_id: crypto.randomUUID() }
}

export async function uploadAsset(formData: FormData) {
  // FIX: Just await the client!
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to upload an asset.' }
  }

  const { influencerId, file } = uploadAssetSchema.parse(
    Object.fromEntries(formData.entries())
  )

  const { data: influencer, error: influencerError } = await supabase
    .from('influencers')
    .select('org_id')
    .eq('id', influencerId)
    .single()

  if (influencerError || !influencer) {
    return { error: 'Influencer not found.' }
  }

  const { org_id } = influencer

  // Check if user is a member of the organization
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('org_id', org_id)
    .single()

  if (memberError || !member) {
    return { error: 'You are not a member of this organization.' }
  }

  const filePath = `${influencerId}/${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('assets')
    .upload(filePath, file)

  if (uploadError) {
    return { error: 'Could not upload asset.' }
  }

  const { data: publicUrl } = supabase.storage
    .from('assets')
    .getPublicUrl(filePath)

  const { error: dbError } = await supabase.from('assets').insert([
    {
      influencer_id: influencerId,
      org_id: org_id,
      url: publicUrl.publicUrl,
      type: file.type.startsWith('image/') ? 'image' : 'video',
    },
  ])

  if (dbError) {
    return { error: 'Could not save asset to database.' }
  }

  revalidatePath(`/influencers/${influencerId}`)
}
