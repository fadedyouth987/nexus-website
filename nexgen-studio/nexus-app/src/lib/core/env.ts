import { z } from 'zod';

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Auth
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional().default('http://localhost:3000'),

  // LLM
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),

  // Redis
  REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),

  // Intervals
  SCHEDULE_PUBLISH_INTERVAL_MS: z.coerce.number().default(15000),
  PERFORMANCE_INGEST_INTERVAL_MS: z.coerce.number().default(60000),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  NEXT_PUBLIC_STRIPE_PUBLIC_KEY: z.string().min(1).optional(),

  // ComfyUI
  COMFYUI_BASE_URL: z.string().url().default('http://127.0.0.1:8188'),
  COMFY_SFW_URL: z.string().url().optional(),
  COMFY_NSFW_URL: z.string().url().optional(),
});

function validateEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    // In production, we might want to throw an error
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid environment variables');
    }
    return process.env as unknown as z.infer<typeof envSchema>;
  }

  return parsed.data;
}

export const env = validateEnv();
