import { z } from 'zod'

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(400).optional(),
  objective: z.string().trim().max(400).optional(),
  status: z.enum(['draft', 'active']).optional(),
})

export const updateProjectSchema = createProjectSchema.extend({
  status: z.enum(['draft', 'active', 'archived']).optional(),
})
