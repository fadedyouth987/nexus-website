type QueueItemTable = 'autopilot_plan_items' | 'series_episodes'

type CreateQueueItemInput = {
  admin: any
  table: QueueItemTable
  parentColumn: 'plan_id' | 'series_id'
  parentId: string
  indexColumn: 'day_index' | 'episode_index'
  indexValue: number
  title: string
  prompt: string
  contentPlanId: string
  scheduledFor?: string
}

export async function createQueueItemRow(input: CreateQueueItemInput) {
  const payload: Record<string, unknown> = {
    [input.parentColumn]: input.parentId,
    [input.indexColumn]: input.indexValue,
    title: input.title,
    prompt: input.prompt,
    content_plan_id: input.contentPlanId,
    status: 'QUEUED',
  }

  if (input.scheduledFor) {
    payload.scheduled_for = input.scheduledFor
  }

  const { data, error } = await input.admin
    .from(input.table)
    .insert(payload)
    .select('id')
    .single()

  if (error || !data?.id) {
    throw new Error(error?.message || `Failed to create queue item in ${input.table}`)
  }

  return {
    id: String(data.id),
  }
}
