import { z } from 'zod'

export const createVideoJobSchema = z.object({
  jobKind: z.enum(['video', 'image']).optional(),
  projectId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  brandKitId: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(160),
  brief: z.string().trim().min(10).max(5000),
  script: z.string().trim().max(12000).optional(),
  provider: z.string().trim().max(40).optional(),
  influencerId: z.string().uuid().optional(),
  workflowTemplateId: z.string().uuid().optional(),
  inputs: z.record(z.string(), z.unknown()).optional(),
})

export const updateVideoJobSchema = createVideoJobSchema.partial().extend({
  title: z.string().trim().min(2).max(160),
  brief: z.string().trim().min(10).max(5000),
})
