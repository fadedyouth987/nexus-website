import { z } from 'zod'

export const waitlistBodySchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  name: z.string().trim().max(200).optional().nullable(),
  contentGoals: z.string().trim().max(5000).optional().nullable(),
  source: z.string().trim().max(120).optional().nullable(),
})

export type WaitlistBody = z.infer<typeof waitlistBodySchema>

export function parseWaitlistBody(json: unknown) {
  return waitlistBodySchema.safeParse(json)
}
