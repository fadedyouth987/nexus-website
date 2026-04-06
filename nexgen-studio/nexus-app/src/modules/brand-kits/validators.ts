import { z } from 'zod'

export const createBrandKitSchema = z.object({
  projectId: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  tone: z.string().trim().max(240).optional(),
  palette: z.array(z.string().trim().min(1).max(32)).max(12).optional(),
  typography: z.array(z.string().trim().min(1).max(120)).max(8).optional(),
  voiceGuidelines: z.string().trim().max(1000).optional(),
})

export const updateBrandKitSchema = createBrandKitSchema
