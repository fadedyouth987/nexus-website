import { z } from 'zod'

export const createCampaignSchema = z.object({
  projectId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  brief: z.string().trim().min(10).max(4000),
  channel: z.string().trim().max(60).optional(),
  objective: z.string().trim().max(400).optional(),
  status: z.enum(['draft', 'ready']).optional(),
})

export const updateCampaignSchema = createCampaignSchema.extend({
  status: z.enum(['draft', 'ready', 'running', 'completed', 'archived']).optional(),
})
