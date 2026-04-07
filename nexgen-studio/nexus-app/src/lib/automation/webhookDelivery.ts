import { createServiceClient } from '@/lib/supabase/service'
import crypto from 'crypto'

export type WebhookEventType = 
  | 'job.completed'
  | 'job.failed'
  | 'job.progress'
  | 'asset.created'
  | 'workflow.started'
  | 'automation.run.completed'
  | 'dlq.job.replayed'

export interface WebhookPayload {
  event: WebhookEventType
  timestamp: string
  org_id?: string
  user_id?: string
  job_id?: string
  asset_id?: string
  data: Record<string, unknown>
}

export async function getWebhookEndpoints(orgId: string): Promise<Array<{
  id: string
  url: string
  secret: string | null
  events: string[]
  headers: Record<string, string>
}>> {
  const service = createServiceClient()
  
  const { data, error } = await service
    .from('webhook_endpoints')
    .select('id, url, secret, events, headers')
    .eq('org_id', orgId)
    .eq('is_active', true)
  
  if (error) {
    console.error('[webhook-delivery] failed to fetch endpoints:', error)
    return []
  }
  
  return (data ?? []).map(endpoint => ({
    id: endpoint.id,
    url: endpoint.url,
    secret: endpoint.secret ?? null,
    events: (endpoint.events as string[]) ?? [],
    headers: (endpoint.headers as Record<string, string>) ?? {},
  }))
}

export async function deliverWebhook(
  endpointId: string,
  payload: WebhookPayload
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  const service = createServiceClient()
  
  const { data: endpoint, error: fetchError } = await service
    .from('webhook_endpoints')
    .select('id, org_id, url, secret, headers')
    .eq('id', endpointId)
    .single()
  
  if (fetchError || !endpoint) {
    return { success: false, error: 'Webhook endpoint not found' }
  }
  
  const { id: webhookEndpointId, org_id, url, secret, headers } = endpoint
  
  // Add webhook-specific fields to payload - ensure timestamp is included
  const webhookPayload = {
    ...payload,
    org_id: payload.org_id ?? org_id,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  }
  
  const body = JSON.stringify(webhookPayload)
  
  // Generate signature if secret is provided
  const signature = secret ? 
    `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}` : 
    undefined
  
  const requestHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'Nexus-App/Webhook-Delivery',
    ...(signature ? { 'X-Signature': signature } : {}),
    ...headers,
  }
  
  try {
    // Using fetch instead of axios since it's available in Node 18+
    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body,
    })
    
    const responseBody = await response.text()
    
    // Find the most recent delivery record for this endpoint and event
    const { data: deliveryData } = await service
      .from('webhook_deliveries')
      .select('id')
      .eq('webhook_endpoint_id', webhookEndpointId)
      .eq('event_type', payload.event)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (deliveryData?.id) {
      // Update delivery record as successful
      await service
        .from('webhook_deliveries')
        .update({
          status: 'delivered',
          response_status: response.status,
          response_body: responseBody,
          delivered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', deliveryData.id)
    }
    
    return { success: true, statusCode: response.status }
  } catch (error: any) {
    const statusCode = error.status ?? 0
    const errorMessage = error.message ?? 'Unknown error'
    
    // Find the most recent delivery record for this endpoint and event
    const { data: deliveryData } = await service
      .from('webhook_deliveries')
      .select('id')
      .eq('webhook_endpoint_id', webhookEndpointId)
      .eq('event_type', payload.event)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (deliveryData?.id) {
      // Update delivery record as failed
      await service
        .from('webhook_deliveries')
        .update({
          status: 'failed',
          response_status: statusCode,
          response_body: error.body ?? null,
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
          next_retry_at: new Date(Date.now() + Math.min(300000, Math.pow(2, 3) * 1000)).toISOString(), // Exponential backoff: 2^attempt * 1s, max 5min
        })
        .eq('id', deliveryData.id)
    }
    
    return { success: false, statusCode, error: errorMessage }
  }
}

export async function createWebhookDeliveryRecord(
  webhookEndpointId: string,
  orgId: string | null,
  eventType: WebhookEventType,
  payload: Record<string, unknown>
): Promise<string> {
  const service = createServiceClient()
  
  const { data } = await service
    .from('webhook_deliveries')
    .insert({
      webhook_endpoint_id: webhookEndpointId,
      org_id: orgId,
      event_type: eventType,
      payload,
      status: 'pending',
      attempt_count: 0,
      max_attempts: 5,
    })
    .select('id')
    .single()
    
  return data?.id ?? ''
}

export async function triggerWebhooksForOrg(
  orgId: string,
  eventType: WebhookEventType,
  data: Record<string, unknown>
): Promise<void> {
  const endpoints = await getWebhookEndpoints(orgId)
  
  for (const endpoint of endpoints) {
    // Filter events if endpoint has specific event subscriptions
    if (endpoint.events.length > 0 && !endpoint.events.includes(eventType)) {
      continue
    }
    
    const payload: WebhookPayload = {
      event: eventType,
      org_id: orgId,
      timestamp: new Date().toISOString(), // Ensure timestamp is set
      data,
    }
    
    // Create delivery record
    const deliveryId = await createWebhookDeliveryRecord(
      endpoint.id,
      orgId,
      eventType,
      payload.data
    )
    
    // Attempt delivery
    await deliverWebhook(endpoint.id, payload)
  }
}

export async function processFailedWebhookDeliveries(): Promise<void> {
  const service = createServiceClient()
  
  // Get deliveries that are ready for retry
  const { data: deliveries, error } = await service
    .from('webhook_deliveries')
    .select('*')
    .eq('status', 'failed')
    .lte('next_retry_at', new Date().toISOString())
    .order('next_retry_at', { ascending: true })
    .limit(50)
  
  if (error) {
    console.error('[webhook-delivery] failed to fetch failed deliveries:', error)
    return
  }
  
  if (!deliveries || deliveries.length === 0) return
  
  // Filter in JS for attempt count
  const filteredDeliveries = deliveries.filter(delivery => 
    delivery.attempt_count < (delivery.max_attempts ?? 5)
  )
  
  for (const delivery of filteredDeliveries) {
    const payload: WebhookPayload = {
      event: delivery.event_type as WebhookEventType,
      org_id: delivery.org_id ?? null,
      user_id: delivery.payload?.user_id ?? null,
      job_id: delivery.payload?.job_id ?? null,
      asset_id: delivery.payload?.asset_id ?? null,
      timestamp: new Date().toISOString(), // Ensure timestamp is set
      data: delivery.payload,
    }
    
    await deliverWebhook(delivery.webhook_endpoint_id, payload)
  }
}
