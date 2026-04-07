import { createServiceClient } from '@/lib/supabase/service'

export type IdempotencyStatus = 'pending' | 'completed' | 'expired'

export type IdempotencyResult =
  | { status: 'new'; key: string; existingResponse: null }
  | { status: 'in_progress'; key: string; existingResponse: null }
  | { status: 'completed'; key: string; existingResponse: { responseStatus: number; responseBody: Record<string, unknown> } }

export async function checkIdempotencyKey(
  key: string,
  orgId: string,
  userId: string,
  method: string,
  path: string,
  body: Record<string, unknown>
): Promise<IdempotencyResult> {
  const service = createServiceClient()

  const { data: existing } = await service
    .from('idempotency_keys')
    .select('*')
    .eq('key', key)
    .single()

  if (existing && existing.status === 'completed' && existing.response_status != null) {
    return {
      status: 'completed',
      key,
      existingResponse: {
        responseStatus: existing.response_status,
        responseBody: (existing.response_body ?? {}) as Record<string, unknown>,
      },
    }
  }

  if (existing && existing.status === 'pending') {
    return { status: 'in_progress', key, existingResponse: null }
  }

  const { error } = await service.from('idempotency_keys').insert({
    key,
    org_id: orgId,
    user_id: userId,
    request_method: method,
    request_path: path,
    request_body: body,
    status: 'pending',
  })

  if (error) {
    if (error.code === '23505') {
      const { data: concurrent } = await service
        .from('idempotency_keys')
        .select('*')
        .eq('key', key)
        .single()

      if (concurrent?.status === 'completed' && concurrent.response_status != null) {
        return {
          status: 'completed',
          key,
          existingResponse: {
            responseStatus: concurrent.response_status,
            responseBody: (concurrent.response_body ?? {}) as Record<string, unknown>,
          },
        }
      }
      return { status: 'in_progress', key, existingResponse: null }
    }
    throw error
  }

  return { status: 'new', key, existingResponse: null }
}

export async function completeIdempotencyKey(
  key: string,
  responseStatus: number,
  responseBody: Record<string, unknown>,
  jobId?: string
): Promise<void> {
  const service = createServiceClient()
  await service
    .from('idempotency_keys')
    .update({
      status: 'completed',
      response_status: responseStatus,
      response_body: responseBody,
      job_id: jobId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('key', key)
    .eq('status', 'pending')
}

export async function expireOldIdempotencyKeys(): Promise<void> {
  const service = createServiceClient()
  await service.rpc('expire_old_idempotency_keys')
}
