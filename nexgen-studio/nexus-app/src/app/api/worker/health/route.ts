import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getToken } from 'next-auth/jwt'
import { requireSupabaseAnonKey, requireSupabaseUrl } from '@/lib/supabase/env'

type JwtTokenLike = {
  accessToken?: string
}

function getAuthSecret() {
  return process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this'
}

function parseWindowMinutes(input: string | null) {
  const value = Number(input || 60)
  if (!Number.isFinite(value) || value <= 0) {
    return 60
  }
  return Math.min(Math.floor(value), 24 * 60)
}

function envBool(value: string | undefined) {
  if (!value) return false
  return value === '1' || value.toLowerCase() === 'true'
}

export async function GET(request: Request) {
  const publishMs = Number(process.env.SCHEDULE_PUBLISH_INTERVAL_MS || 15000)
  const ingestMs = Number(process.env.PERFORMANCE_INGEST_INTERVAL_MS || 60000)
  const supabaseAdminReady = Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const redisReady = Boolean(process.env.REDIS_URL)
  const publisherMode = process.env.PUBLISHER_MODE || 'mock'
  const v2Enabled = envBool(process.env.ENABLE_V2_PORTFOLIO) || envBool(process.env.NEXT_PUBLIC_ENABLE_V2_PORTFOLIO)

  const reasonsDisabled: string[] = []
  if (!supabaseAdminReady) reasonsDisabled.push('missing_supabase_admin_credentials')
  if (!redisReady) reasonsDisabled.push('missing_redis_url')
  if (!v2Enabled) reasonsDisabled.push('v2_flag_disabled')

  const enabled = reasonsDisabled.length === 0
  const windowMinutes = parseWindowMinutes(new URL(request.url).searchParams.get('window_min'))
  const basePayload = {
    ok: true,
    route: '/api/worker/health',
    enabled,
    reasons_disabled: reasonsDisabled,
    publisher_running: enabled,
    ingestion_running: enabled,
    config: {
      supabase_admin_ready: supabaseAdminReady,
      redis_ready: redisReady,
      publisher_mode: publisherMode,
      worker_intervals: {
        publish_ms: publishMs,
        ingest_ms: ingestMs,
      },
      v2_enabled: v2Enabled,
    },
    throughput: {
      window_min: windowMinutes,
      published: 0,
      failed: 0,
      performance_writes: 0,
    },
    queue: {
      due_backlog: 0,
    },
    generation_safe_image_running: enabled,
    last_generation_success: null as null | string,
    last_generation_failure: null as null | string,
    latest: {
      published: null as null | Record<string, unknown>,
      failed: null as null | Record<string, unknown>,
      performance: null as null | Record<string, unknown>,
    },
    counters_scope: 'public',
  }

  try {
    const token = (await getToken({
      req: request as any,
      secret: getAuthSecret(),
    })) as JwtTokenLike | null

    const accessToken = typeof token?.accessToken === 'string' ? token.accessToken : null
    const workspaceId = new URL(request.url).searchParams.get('workspace_id')

    if (!accessToken || !workspaceId) {
      return NextResponse.json(basePayload)
    }

    let supabaseUrl: string
    let supabaseAnon: string
    try {
      supabaseUrl = requireSupabaseUrl()
      supabaseAnon = requireSupabaseAnonKey()
    } catch {
      return NextResponse.json({
        ...basePayload,
        reasons_disabled: [...basePayload.reasons_disabled, 'missing_supabase_runtime_credentials'],
      })
    }

    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: { persistSession: false },
    })

    const nowIso = new Date().toISOString()
    const sinceIso = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()

    const [
      publishedCount,
      failedCount,
      backlogCount,
      perfCount,
      latestPublished,
      latestFailed,
      latestPerf,
      latestGenerationSuccess,
      latestGenerationFailure,
    ] =
      await Promise.all([
        supabase
          .from('schedules_v2')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('status', 'published')
          .gte('created_at', sinceIso),
        supabase
          .from('schedules_v2')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('status', 'failed')
          .gte('created_at', sinceIso),
        supabase
          .from('schedules_v2')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .in('status', ['queued', 'scheduled'])
          .lte('scheduled_for', nowIso),
        supabase
          .from('performance_v2')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .gte('recorded_at', sinceIso),
        supabase
          .from('schedules_v2')
          .select('id, content_id, platform, created_at')
          .eq('workspace_id', workspaceId)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('schedules_v2')
          .select('id, content_id, platform, created_at, error')
          .eq('workspace_id', workspaceId)
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('performance_v2')
          .select('id, content_id, platform, recorded_at, views, engagement, revenue')
          .eq('workspace_id', workspaceId)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('activity_log')
          .select('created_at')
          .eq('workspace_id', workspaceId)
          .eq('action', 'generation.safe_image.succeeded')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('activity_log')
          .select('created_at')
          .eq('workspace_id', workspaceId)
          .eq('action', 'generation.safe_image.failed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

    const queryErrors = [
      publishedCount.error,
      failedCount.error,
      backlogCount.error,
      perfCount.error,
      latestPublished.error,
      latestFailed.error,
      latestPerf.error,
      latestGenerationSuccess.error,
      latestGenerationFailure.error,
    ].filter(Boolean)

    if (queryErrors.length > 0) {
      return NextResponse.json({
        ...basePayload,
        counters_scope: 'authenticated',
        counters_error: 'Failed to load workspace counters',
      })
    }

    return NextResponse.json({
      ...basePayload,
      counters_scope: 'authenticated',
      throughput: {
        window_min: windowMinutes,
        published: publishedCount.count ?? 0,
        failed: failedCount.count ?? 0,
        performance_writes: perfCount.count ?? 0,
      },
      queue: {
        due_backlog: backlogCount.count ?? 0,
      },
      generation_safe_image_running: enabled,
      last_generation_success: latestGenerationSuccess.data?.created_at || null,
      last_generation_failure: latestGenerationFailure.data?.created_at || null,
      latest: {
        published: latestPublished.data ?? null,
        failed: latestFailed.data ?? null,
        performance: latestPerf.data ?? null,
      },
    })
  } catch {
    return NextResponse.json(basePayload)
  }
}
