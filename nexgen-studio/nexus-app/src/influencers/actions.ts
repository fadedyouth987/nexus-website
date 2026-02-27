'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const createInfluencerSchema = z.object({
  name: z.string().min(3),
  handle: z.string().min(3),
  niche: z.string().min(3),
  orgId: z.string().uuid(),
})

import { logEvent } from '@/audit-logs/actions'

type InfluencerActionState = { error: string | null }

export async function createInfluencer(_prevState: InfluencerActionState | undefined, formData: FormData): Promise<InfluencerActionState> {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to create an influencer.' }
  }

  const { name, handle, niche, orgId } = createInfluencerSchema.parse(
    Object.fromEntries(formData.entries())
  )

  // Check if user is a member of the organization
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('org_id', orgId)
    .single()

  if (memberError || !member) {
    return { error: 'You are not a member of this organization.' }
  }

  const { data: newInfluencer, error: influencerError } = await supabase
    .from('influencers')
    .insert([
      {
        name,
        handle,
        niche,
        org_id: orgId,
      },
    ])
    .select()
    .single()

  if (influencerError) {
    return { error: 'Could not create influencer.' }
  }

  await logEvent('create_influencer', newInfluencer.id)

  revalidatePath(`/organizations/${orgId}`)
  
  return { error: null }
}
