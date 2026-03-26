import { z } from 'zod'

/**
 * Optional runtime validation — does not throw in development when vars are missing
 * so local `next dev` / tests keep working without a full `.env`.
 */
const coreSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  SUPABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().min(1).optional(),
  COMFYUI_URL: z.string().url().optional(),
})

export type ParsedCoreEnv = z.infer<typeof coreSchema>

export function parseCoreEnv(): ParsedCoreEnv {
  const r = coreSchema.safeParse(process.env)
  if (!r.success && process.env.NODE_ENV === 'production') {
    console.warn('[env] Some optional env keys failed validation:', r.error.flatten().fieldErrors)
  }
  return r.success ? r.data : {}
}
