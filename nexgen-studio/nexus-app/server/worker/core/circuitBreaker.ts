/**
 * Circuit Breaker Pattern for Provider Health
 *
 * Prevents hammering failing providers by opening circuit after threshold
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold reached, requests fail fast
 * - HALF_OPEN: Testing if provider recovered
 */

import { logger } from './logger'

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

interface CircuitBreakerConfig {
  failureThreshold: number // Failures before opening
  recoveryTimeoutMs: number // Time before half-open attempt
  halfOpenMaxAttempts: number // Successful attempts needed to close
}

interface CircuitBreakerRecord {
  state: CircuitState
  failureCount: number
  lastFailureTime: number
  successCount: number // For half-open recovery
  totalFailures: number // Lifetime counter
  totalSuccesses: number // Lifetime counter
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeoutMs: 5 * 60 * 1000, // 5 minutes
  halfOpenMaxAttempts: 3,
}

// In-memory store (per-worker process)
const circuits = new Map<string, CircuitBreakerRecord>()

function getCircuit(providerKey: string): CircuitBreakerRecord {
  if (!circuits.has(providerKey)) {
    circuits.set(providerKey, {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: 0,
      successCount: 0,
      totalFailures: 0,
      totalSuccesses: 0,
    })
  }
  return circuits.get(providerKey)!
}

function updateCircuit(providerKey: string, updates: Partial<CircuitBreakerRecord>) {
  const current = getCircuit(providerKey)
  circuits.set(providerKey, { ...current, ...updates })
}

/**
 * Check if a provider is available (circuit closed or half-open)
 */
export function isProviderAvailable(providerKey: string): {
  available: boolean
  state: CircuitState
  reason?: string
} {
  const circuit = getCircuit(providerKey)

  if (circuit.state === 'CLOSED') {
    return { available: true, state: 'CLOSED' }
  }

  if (circuit.state === 'OPEN') {
    const timeSinceFailure = Date.now() - circuit.lastFailureTime

    if (timeSinceFailure >= DEFAULT_CONFIG.recoveryTimeoutMs) {
      // Transition to half-open
      updateCircuit(providerKey, {
        state: 'HALF_OPEN',
        failureCount: 0,
        successCount: 0,
      })
      logger.info(`Circuit breaker half-open for ${providerKey}`)
      return { available: true, state: 'HALF_OPEN', reason: 'Testing recovery' }
    }

    return {
      available: false,
      state: 'OPEN',
      reason: `Circuit open - recovery in ${Math.ceil(
        (DEFAULT_CONFIG.recoveryTimeoutMs - timeSinceFailure) / 1000
      )}s`,
    }
  }

  // HALF_OPEN - allow limited traffic
  return { available: true, state: 'HALF_OPEN', reason: 'Recovery testing' }
}

/**
 * Record a successful provider call
 */
export function recordSuccess(providerKey: string): void {
  const circuit = getCircuit(providerKey)

  if (circuit.state === 'HALF_OPEN') {
    const newSuccessCount = circuit.successCount + 1

    if (newSuccessCount >= DEFAULT_CONFIG.halfOpenMaxAttempts) {
      // Circuit closes - provider recovered
      updateCircuit(providerKey, {
        state: 'CLOSED',
        failureCount: 0,
        successCount: 0,
        totalSuccesses: circuit.totalSuccesses + 1,
      })
      logger.info(`Circuit breaker closed for ${providerKey} - provider recovered`)
    } else {
      updateCircuit(providerKey, {
        successCount: newSuccessCount,
        totalSuccesses: circuit.totalSuccesses + 1,
      })
    }
  } else {
    // Reset failure count in closed state on success
    if (circuit.failureCount > 0) {
      updateCircuit(providerKey, { failureCount: 0 })
    }
    updateCircuit(providerKey, {
      totalSuccesses: circuit.totalSuccesses + 1,
    })
  }
}

/**
 * Record a failed provider call
 */
export function recordFailure(providerKey: string, error: Error | string): void {
  const circuit = getCircuit(providerKey)
  const newFailureCount = circuit.failureCount + 1

  if (circuit.state === 'HALF_OPEN') {
    // Failure in half-open -> back to open immediately
    updateCircuit(providerKey, {
      state: 'OPEN',
      failureCount: newFailureCount,
      lastFailureTime: Date.now(),
      totalFailures: circuit.totalFailures + 1,
    })
    logger.warn(`Circuit breaker re-opened for ${providerKey} - recovery failed`, {
      error: error instanceof Error ? error.message : error,
    })
    return
  }

  // Check if threshold reached
  if (newFailureCount >= DEFAULT_CONFIG.failureThreshold) {
    updateCircuit(providerKey, {
      state: 'OPEN',
      failureCount: newFailureCount,
      lastFailureTime: Date.now(),
      totalFailures: circuit.totalFailures + 1,
    })
    logger.error(`Circuit breaker opened for ${providerKey}`, {
      failures: newFailureCount,
      error: error instanceof Error ? error.message : error,
    })
  } else {
    updateCircuit(providerKey, {
      failureCount: newFailureCount,
      lastFailureTime: Date.now(),
      totalFailures: circuit.totalFailures + 1,
    })
  }
}

/**
 * Get circuit breaker status for all providers
 */
export function getAllCircuitStatus(): Array<{
  provider: string
  state: CircuitState
  failureCount: number
  successCount: number
  totalFailures: number
  totalSuccesses: number
  lastFailureAgo: string
}> {
  return Array.from(circuits.entries()).map(([provider, circuit]) => ({
    provider,
    state: circuit.state,
    failureCount: circuit.failureCount,
    successCount: circuit.successCount,
    totalFailures: circuit.totalFailures,
    totalSuccesses: circuit.totalSuccesses,
    lastFailureAgo: circuit.lastFailureTime
      ? `${Math.round((Date.now() - circuit.lastFailureTime) / 1000)}s ago`
      : 'never',
  }))
}

/**
 * Reset a circuit breaker (for manual recovery or testing)
 */
export function resetCircuit(providerKey: string): void {
  circuits.delete(providerKey)
  logger.info(`Circuit breaker manually reset for ${providerKey}`)
}

/**
 * Get provider key from job details
 */
export function getProviderKey(backend: 'comfyui' | 'runpod', mode: 'IMAGE' | 'VIDEO', policy: 'SFW' | 'NSFW'): string {
  return `${backend}:${mode}:${policy}`
}
