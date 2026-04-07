/**
 * Webhook Delivery System
 *
 * Delivers job state changes to external URLs with:
 * - HMAC-SHA256 signature verification
 * - Exponential backoff retry
 * - Dead letter queue for failed deliveries
 */

import crypto from 'crypto'
import { logger } from './logger'

interface WebhookPayload {
  event: string
  jobId: string
  organizationId: string
  status: string
  timestamp: string
  data: Record<string, unknown>
}

interface WebhookDeliveryResult {
  success: boolean
  statusCode?: number
  error?: string
  willRetry?: boolean
}

const MAX_DELIVERY_ATTEMPTS = 3

/**
 * Sign payload with webhook secret
 */
function signPayload(payload: WebhookPayload, secret: string): string {
  const payloadString = JSON.stringify(payload)
  return crypto.createHmac('sha256', secret).update(payloadString).digest('hex')
}

/**
 * Deliver webhook with retry
 */
async function deliverWithRetry(
  url: string,
  payload: WebhookPayload,
  secret: string,
  attempt: number = 1
): Promise<WebhookDeliveryResult> {
  const signature = signPayload(payload, secret)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': `sha256=${signature}`,
    'X-Webhook-Event': payload.event,
    'X-Webhook-Attempt': String(attempt),
    'User-Agent': 'NexGen-Studio-Webhook/1.0',
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      // Timeout increases with each attempt
      signal: AbortSignal.timeout(30000 * attempt),
    })

    if (response.ok) {
      return { success: true, statusCode: response.status }
    }

    // Non-2xx response
    const shouldRetry = attempt < MAX_DELIVERY_ATTEMPTS && isRetryableStatus(response.status)

    if (shouldRetry) {
      const delayMs = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
      logger.warn(`Webhook delivery failed, will retry`, {
        url,
        attempt,
        status: response.status,
        delayMs,
      })
      await sleep(delayMs)
      return deliverWithRetry(url, payload, secret, attempt + 1)
    }

    return {
      success: false,
      statusCode: response.status,
      error: `HTTP ${response.status}`,
      willRetry: false,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const shouldRetry = attempt < MAX_DELIVERY_ATTEMPTS

    if (shouldRetry) {
      const delayMs = Math.pow(2, attempt) * 1000
      logger.warn(`Webhook delivery error, will retry`, {
        url,
        attempt,
        error: errorMessage,
        delayMs,
      })
      await sleep(delayMs)
      return deliverWithRetry(url, payload, secret, attempt + 1)
    }

    return {
      success: false,
      error: errorMessage,
      willRetry: false,
    }
  }
}

function isRetryableStatus(status: number): boolean {
  // Retry on rate limit, server errors, or gateway errors
  return status === 429 || status >= 500
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch webhooks for an organization and deliver event
 */
export async function notifyWebhooks(
  admin: any,
  event: string,
  jobId: string,
  orgId: string,
  status: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  // Fetch active webhooks for this org that subscribe to this event
  const { data: webhooks, error } = await admin
    .from('organization_webhooks')
    .select('id, url, secret_key, events')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .contains('events', [event])

  if (error) {
    logger.error('Failed to fetch webhooks', { error: error.message, orgId, event })
    return
  }

  if (!webhooks?.length) {
    return // No webhooks to notify
  }

  const payload: WebhookPayload = {
    event,
    jobId,
    organizationId: orgId,
    status,
    timestamp: new Date().toISOString(),
    data,
  }

  // Deliver to all webhooks in parallel (don't block on any)
  await Promise.all(
    webhooks.map(async (wh: { id: string; url: string; secret_key: string }) => {
      const result = await deliverWithRetry(wh.url, payload, wh.secret_key)

      // Log delivery attempt
      await admin.from('webhook_deliveries').insert({
        webhook_id: wh.id,
        job_id: jobId,
        event,
        payload: payload,
        success: result.success,
        status_code: result.statusCode,
        error_message: result.error,
        delivered_at: result.success ? new Date().toISOString() : null,
      })

      if (!result.success) {
        logger.error('Webhook delivery failed after all retries', {
          webhookId: wh.id,
          url: wh.url,
          event,
          error: result.error,
        })
      }
    })
  )
}

/**
 * Quick event helpers
 */
export async function notifyGenerationQueued(
  admin: any,
  jobId: string,
  orgId: string,
  data: { mode: string; workflowTemplateId?: string; influencerId?: string }
): Promise<void> {
  return notifyWebhooks(admin, 'generation.queued', jobId, orgId, 'queued', data)
}

export async function notifyGenerationGenerating(
  admin: any,
  jobId: string,
  orgId: string,
  data: { provider: string; promptId?: string }
): Promise<void> {
  return notifyWebhooks(admin, 'generation.generating', jobId, orgId, 'generating', data)
}

export async function notifyGenerationReady(
  admin: any,
  jobId: string,
  orgId: string,
  data: { assetIds: string[]; assetCount: number }
): Promise<void> {
  return notifyWebhooks(admin, 'generation.ready', jobId, orgId, 'ready', data)
}

export async function notifyGenerationFailed(
  admin: any,
  jobId: string,
  orgId: string,
  data: { error: string; failureCode?: string; willRetry?: boolean }
): Promise<void> {
  return notifyWebhooks(admin, 'generation.failed', jobId, orgId, 'failed', data)
}

export async function notifyGenerationCancelled(
  admin: any,
  jobId: string,
  orgId: string,
  data: { reason?: string }
): Promise<void> {
  return notifyWebhooks(admin, 'generation.cancelled', jobId, orgId, 'cancelled', data)
}
