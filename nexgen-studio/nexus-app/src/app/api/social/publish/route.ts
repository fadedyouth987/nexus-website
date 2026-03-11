import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getProvider } from '@/lib/social/providers'
import { getAccountById, getAccessToken } from '@/lib/social/socialService'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'
import { getPublishQueue } from '@/lib/social/queue'
import type { SocialProviderId } from '@/lib/social/providerInterface'
import { canPublishContentToPlatform, normalizeContentRating } from '@/lib/social/platformPolicy'

export async function POST(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  let body: { accountId: string; caption?: string; mediaUrls?: string[]; scheduledFor?: string; contentRating?: 'sfw' | 'nsfw' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 })
  }

  const { accountId, caption = '', mediaUrls = [], scheduledFor } = body
  const contentRating = normalizeContentRating(body.contentRating)
  if (!accountId) {
    return NextResponse.json({ detail: 'accountId required' }, { status: 400 })
  }

  const account = await getAccountById(accountId, token.sub)
  if (!account) {
    return NextResponse.json({ detail: 'Account not found' }, { status: 404 })
  }
  if (!canPublishContentToPlatform(account.provider, contentRating)) {
    return NextResponse.json(
      { detail: `${account.provider} does not allow ${contentRating.toUpperCase()} publishing in Nexus policy.` },
      { status: 400 }
    )
  }
  if (contentRating === 'nsfw') {
    const cookieHeader = request.headers.get('cookie') || ''
    const hasAgeCookie = cookieHeader.includes('age_verified_18=true')
    const hasTermsCookie = cookieHeader.includes('nexgen_terms_accepted_18=true')
    const hasNsfwGateCookie = cookieHeader.includes('nexgen_nsfw_gate_enabled=true')
    if (!hasAgeCookie || !hasTermsCookie || !hasNsfwGateCookie) {
      return NextResponse.json(
        { detail: 'NSFW publishing is gated until age verification, terms acceptance, and NSFW gate are complete.' },
        { status: 403 }
      )
    }
  }

  const admin = getEngineSupabaseAdmin()
  const { data: job, error: insertError } = await admin
    .from('publish_jobs')
    .insert({
      user_id: token.sub,
      social_account_id: accountId,
      provider: account.provider,
      post_content: caption,
      media_urls: mediaUrls,
      scheduled_for: scheduledFor || null,
      status: scheduledFor ? 'pending' : 'queued',
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ detail: insertError.message }, { status: 500 })
  }

  if (scheduledFor) {
    const queue = getPublishQueue()
    if (queue) {
      await queue.add(
        'scheduled',
        {
          jobId: job.id,
          userId: token.sub,
          socialAccountId: accountId,
          provider: account.provider,
          caption,
          mediaUrls,
          scheduledFor,
          retryCount: 0,
        },
        { delay: Math.max(0, new Date(scheduledFor).getTime() - Date.now()) }
      )
    }
    return NextResponse.json({
      jobId: job.id,
      status: 'pending',
      scheduledFor,
      message: 'Scheduled for publish. Worker will run at scheduled time.',
    })
  }

  try {
    const accessToken = await getAccessToken(account)
    const provider = getProvider(account.provider as SocialProviderId)
    const result = await provider.publishPost({
      accountId: account.account_id,
      accessToken,
      caption,
      mediaUrls,
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
        .eq('id', job.id)
      return NextResponse.json({
        jobId: job.id,
        status: 'published',
        externalPostId: result.externalPostId,
      })
    }
    await admin
      .from('publish_jobs')
      .update({
        status: 'failed',
        error_message: result.error,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
    return NextResponse.json(
      { jobId: job.id, status: 'failed', error: result.error },
      { status: 422 }
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Publish failed'
    await admin
      .from('publish_jobs')
      .update({
        status: 'failed',
        error_message: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
