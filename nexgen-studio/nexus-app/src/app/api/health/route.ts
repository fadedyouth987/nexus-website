import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getRedis } from '@/lib/redis'

type ServiceState = 'ok' | 'error' | 'skipped'

export async function GET() {
  let status: 'ok' | 'degraded' = 'ok'
  const services: { database: ServiceState; redis: ServiceState; comfyui: ServiceState } = {
    database: 'skipped',
    redis: 'skipped',
    comfyui: 'skipped',
  }

  try {
    const svc = createServiceClient()
    const { error } = await svc.from('subscription_plans').select('id').limit(1)
    services.database = error ? 'error' : 'ok'
    if (error) {
      status = 'degraded'
    }
  } catch {
    services.database = 'error'
    status = 'degraded'
  }

  try {
    const redis = getRedis()
    if (redis) {
      await redis.ping()
      services.redis = 'ok'
    } else {
      services.redis = 'skipped'
    }
  } catch {
    services.redis = 'error'
    status = 'degraded'
  }

  const comfyBase = process.env.COMFYUI_URL?.replace(/\/$/, '')
  try {
    if (!comfyBase) {
      services.comfyui = 'skipped'
    } else {
      const res = await fetch(`${comfyBase}/system_stats`, {
        signal: AbortSignal.timeout(5000),
      })
      services.comfyui = res.ok ? 'ok' : 'error'
      if (!res.ok) {
        status = 'degraded'
      }
    }
  } catch {
    services.comfyui = 'error'
    status = 'degraded'
  }

  const payload = {
    status,
    timestamp: new Date().toISOString(),
    services,
  }

  return NextResponse.json(payload, { status: status === 'ok' ? 200 : 503 })
}
