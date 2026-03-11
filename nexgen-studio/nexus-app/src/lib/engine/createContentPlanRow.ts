type CreateContentPlanInput = {
  admin: any
  influencerId: string
  orgId: string
  theme: string
  notes: string
  date: string
}

export async function createContentPlanRow(input: CreateContentPlanInput) {
  const { data, error } = await input.admin
    .from('content_plans')
    .insert({
      influencer_id: input.influencerId,
      org_id: input.orgId,
      theme: input.theme,
      notes: input.notes,
      date: input.date,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(error?.message || 'Failed to create content plan row')
  }

  return {
    id: String(data.id),
  }
}
