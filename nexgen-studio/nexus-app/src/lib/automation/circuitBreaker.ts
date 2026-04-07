import { createServiceClient } from '@/lib/supabase/service'

export type CircuitState = 'closed' | 'open' | 'half_open'

export interface CircuitBreakerConfig {
  failureThreshold: number
  successThreshold: number
  timeoutMs: number
}

const DEFAULT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  comfyui: { failureThreshold: 5, successThreshold: 3, timeoutMs: 30000 },
  s3: { failureThreshold: 3, successThreshold: 3, timeoutMs: 15000 },
  supabase: { failureThreshold: 3, successThreshold: 3, timeoutMs: 10000 },
}

export async function getCircuitState(serviceName: string): Promise<{ state: CircuitState; config: CircuitBreakerConfig }> {
  const service = createServiceClient()
  const { data } = await service
    .from('circuit_breaker_state')
    .select('*')
    .eq('service_name', serviceName)
    .single()

  const config = DEFAULT_CONFIGS[serviceName] ?? { failureThreshold: 5, successThreshold: 3, timeoutMs: 30000 }

  if (!data) {
    await service.from('circuit_breaker_state').insert({
      service_name: serviceName,
      state: 'closed',
      failure_threshold: config.failureThreshold,
      success_threshold: config.successThreshold,
      timeout_ms: config.timeoutMs,
    })
    return { state: 'closed', config }
  }

  if (data.state === 'open' && data.opened_at) {
    const elapsed = Date.now() - new Date(data.opened_at).getTime()
    if (elapsed >= data.timeout_ms) {
      await service
        .from('circuit_breaker_state')
        .update({ state: 'half_open', half_open_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('service_name', serviceName)
      return { state: 'half_open', config }
    }
  }

  return { state: data.state as CircuitState, config }
}

export async function recordSuccess(serviceName: string): Promise<void> {
  const service = createServiceClient()
  const { data } = await service
    .from('circuit_breaker_state')
    .select('*')
    .eq('service_name', serviceName)
    .single()

  if (!data) return

  const newSuccessCount = (data.success_count ?? 0) + 1

  if (data.state === 'half_open' && newSuccessCount >= data.success_threshold) {
    await service
      .from('circuit_breaker_state')
      .update({
        state: 'closed',
        failure_count: 0,
        success_count: newSuccessCount,
        last_success_at: new Date().toISOString(),
        opened_at: null,
        half_open_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('service_name', serviceName)
  } else if (data.state === 'open') {
    await service
      .from('circuit_breaker_state')
      .update({
        success_count: newSuccessCount,
        last_success_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('service_name', serviceName)
  } else {
    await service
      .from('circuit_breaker_state')
      .update({
        success_count: newSuccessCount,
        last_success_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('service_name', serviceName)
  }
}

export async function recordFailure(serviceName: string, error?: Error): Promise<void> {
  const service = createServiceClient()
  const { data } = await service
    .from('circuit_breaker_state')
    .select('*')
    .eq('service_name', serviceName)
    .single()

  if (!data) return

  const newFailureCount = (data.failure_count ?? 0) + 1
  const now = new Date().toISOString()

  if (newFailureCount >= data.failure_threshold && data.state !== 'open') {
    await service
      .from('circuit_breaker_state')
      .update({
        state: 'open',
        failure_count: newFailureCount,
        last_failure_at: now,
        opened_at: now,
        updated_at: now,
      })
      .eq('service_name', serviceName)
    console.error(`[circuit-breaker] ${serviceName} OPENED after ${newFailureCount} failures`)
  } else {
    await service
      .from('circuit_breaker_state')
      .update({
        failure_count: newFailureCount,
        last_failure_at: now,
        updated_at: now,
      })
      .eq('service_name', serviceName)
  }
}

export class CircuitBreakerError extends Error {
  constructor(public serviceName: string, public state: CircuitState) {
    super(`Circuit breaker for ${serviceName} is ${state}`)
    this.name = 'CircuitBreakerError'
  }
}

export async function assertCircuitClosed(serviceName: string): Promise<void> {
  const { state } = await getCircuitState(serviceName)
  if (state === 'open') {
    throw new CircuitBreakerError(serviceName, state)
  }
}

export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>
): Promise<T> {
  await assertCircuitClosed(serviceName)

  try {
    const result = await fn()
    await recordSuccess(serviceName)
    return result
  } catch (error) {
    await recordFailure(serviceName, error instanceof Error ? error : undefined)
    throw error
  }
}
