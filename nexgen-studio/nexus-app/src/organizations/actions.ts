'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { logEvent } from '@/audit-logs/actions'

const createOrganizationSchema = z.object({
  name: z.string().min(3),
})

type OrganizationActionState = { error: string | null }

export async function createOrganization(_prevState: OrganizationActionState | undefined, formData: FormData): Promise<OrganizationActionState> {
  const cookieStore = await cookies()
  const supabase = await createClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be logged in to create an organization.' }
  }

  const { name } = createOrganizationSchema.parse(Object.fromEntries(formData.entries()))

  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .insert([{ name }])
    .select()
    .single()

  if (orgError) {
    return { error: 'Could not create organization.' }
  }

  const { error: memberError } = await supabase.from('organization_members').insert([
    {
      org_id: organization.id,
      user_id: user.id,
      role: 'owner',
    },
  ])

  if (memberError) {
    // Here you might want to handle the case where the organization was created but the member was not.
    // For simplicity, we'll just return the error.
    return { error: 'Could not add user to organization.' }
  }

  await logEvent('create_organization', organization.id)

  revalidatePath('/organizations')
  
  return { error: null }
}
