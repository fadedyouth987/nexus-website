/**
 * BullMQ worker: processes social publish jobs from the queue.
 * Run with: npx tsx src/workers/publishWorker.ts
 * Requires REDIS_URL and Supabase env vars.
 */

import { Worker } from 'bullmq'
import { getProvider } from '@/lib/social/providers'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { getAccessToken } from '@/lib/social/socialService'
import type { SocialProviderId } from '@/lib/social/providerInterface'
import type { PublishJobPayload } from '@/lib/social/queue'
import { getRetryQueue } from '@/lib/social/queue'

const REDIS_URL = process.env.REDIS_URL
if (!REDIS_URL) {
  console.error('REDIS_URL required for publish worker')
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

async function processJob(payload: PublishJobPayload) {
  const admin = getEngineSupabaseAdmin()
  const { data: account, error: accErr } = await admin
    .from('social_accounts')
    .select('*')
    .eq('id', payload.socialAccountId)
    .single()
  if (accErr || !account) {
    throw new Error('Account not found')
  }
  await admin
    .from('publish_jobs')
    .update({ status: 'publishing', updated_at: new Date().toISOString() })
    .eq('id', payload.jobId)

  const accessToken = await getAccessToken(account as any)
  const provider = getProvider(payload.provider as SocialProviderId)
  const result = await provider.publishPost({
    accountId: account.account_id,
    accessToken,
    caption: payload.caption,
    mediaUrls: payload.mediaUrls,
  })

  if (result.success) {
    await admin
      .from('publish_jobs')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        external_post_id: result.externalPostId,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.jobId)
    if (payload.scheduleId) {
      await admin
        .from('schedules_v2')
        .update({ status: 'published', error: {} })
        .eq('id', payload.scheduleId)
    }
    if (payload.contentId) {
      await admin
        .from('content_v2')
        .update({ status: 'published' })
        .eq('id', payload.contentId)
    }
  } else {
    await admin
      .from('publish_jobs')
      .update({
        status: 'failed',
        error_message: result.error,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.jobId)
    if (payload.scheduleId) {
      await admin
        .from('schedules_v2')
        .update({ status: 'failed', error: { reason: result.error } })
        .eq('id', payload.scheduleId)
    }
    if (payload.contentId) {
      await admin
        .from('content_v2')
        .update({ status: 'failed' })
        .eq('id', payload.contentId)
    }
    const retryCount = Number(payload.retryCount || 0)
    if (retryCount < 3) {
      const retryQueue = getRetryQueue()
      if (retryQueue) {
        await retryQueue.add('publish-retry', payload, { delay: (retryCount + 1) * 60 * 1000 })
      }
    }
    throw new Error(result.error)
  }
}

const worker = new Worker(
  'social-publish',
  async (job) => {
    console.log('[publishWorker] Job', job.id, job.data.jobId)
    await processJob(job.data)
  },
  { connection }
)

worker.on('completed', (job) => {
  console.log('[publishWorker] Completed', job.id)
})

worker.on('failed', (job, err) => {
  console.error('[publishWorker] Failed', job?.id, err.message)
})

worker.on('error', (err) => {
  console.error('[publishWorker] Worker error', err)
})

console.log('[publishWorker] Listening for jobs on queue social-publish')
