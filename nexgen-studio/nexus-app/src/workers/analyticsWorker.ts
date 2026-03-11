/**
 * BullMQ worker: fetches analytics from connected social accounts and stores snapshots.
 * Run with: npx tsx src/workers/analyticsWorker.ts
 */

import { Worker } from 'bullmq'
import { getProvider } from '@/lib/social/providers'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { getAccessToken } from '@/lib/social/socialService'
import type { SocialProviderId } from '@/lib/social/providerInterface'
import type { AnalyticsJobPayload } from '@/lib/social/queue'

const REDIS_URL = process.env.REDIS_URL
if (!REDIS_URL) {
  console.error('REDIS_URL required for analytics worker')
  process.exit(1)
}

const connection = (() => {
  try {
    const u = new URL(REDIS_URL)
    return {
      host: u.hostname,
      port: parseInt(u.port || '6379', 10),
      password: u.password || undefined,
      maxRetriesPerRequest: null,
    }
  } catch {
    return null
  }
})()

if (!connection) {
  console.error('Invalid REDIS_URL')
  process.exit(1)
}

async function processJob(payload: AnalyticsJobPayload) {
  const admin = getEngineSupabaseAdmin()
  const { data: account, error: accErr } = await admin
    .from('social_accounts')
    .select('*')
    .eq('id', payload.socialAccountId)
    .single()
  if (accErr || !account) {
    throw new Error('Account not found')
  }

  const accessToken = await getAccessToken(account as any)
  const provider = getProvider(payload.provider as SocialProviderId)
  const metrics = await provider.fetchAnalytics(account.account_id, accessToken)

  for (const m of metrics) {
    await admin.from('analytics_snapshots').insert({
      social_account_id: payload.socialAccountId,
      provider: payload.provider,
      metric_type: m.metricType,
      metric_value: m.value,
      captured_at: m.capturedAt.toISOString(),
    })
  }
}

const worker = new Worker(
  'social-analytics',
  async (job) => {
    console.log('[analyticsWorker] Job', job.id, job.data.socialAccountId)
    await processJob(job.data)
  },
  { connection }
)

worker.on('completed', (job) => {
  console.log('[analyticsWorker] Completed', job.id)
})

worker.on('failed', (job, err) => {
  console.error('[analyticsWorker] Failed', job?.id, err.message)
})

console.log('[analyticsWorker] Listening for jobs on queue social-analytics')
