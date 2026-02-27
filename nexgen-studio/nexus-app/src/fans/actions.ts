'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const addFanSchema = z.object({
  username: z.string().min(1),
  platform: z.string().min(1),
  influencerId: z.string().uuid(),
})

export async function addFan(formData: FormData) {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to add a fan.' }
  }

  const { username, platform, influencerId } = addFanSchema.parse(
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

  const { error } = await supabase.from('fans').insert([
    {
      username,
      platform,
      influencer_id: influencerId,
    },
  ])

  if (error) {
    return { error: 'Could not add fan.' }
  }

  revalidatePath(`/influencers/${influencerId}`)
}
