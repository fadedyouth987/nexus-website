/**
 * Auto-Retry Policy with Exponential Backoff
 *
 * Classifies errors as TRANSIENT (retryable) or PERMANENT (fail immediately)
 * Implements exponential backoff with jitter for retries
 */

export type ErrorClassification = 'TRANSIENT' | 'PERMANENT' | 'CANCELLED'

export interface RetryConfig {
  maxAutoRetries: number
  baseDelayMs: number
  maxDelayMs: number
  jitterFactor: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAutoRetries: 3,
  baseDelayMs: 60_000, // 1 minute
  maxDelayMs: 600_000, // 10 minutes
  jitterFactor: 0.3, // ±30% jitter
}

/**
 * Classify an error for retry behavior
 */
export function classifyError(error: Error | string | null): ErrorClassification {
  const message = (error instanceof Error ? error.message : error || '').toLowerCase()
  const name = error instanceof Error ? error.name : ''

  // Cancellations are never retried
  if (
    message.includes('cancelled') ||
    message.includes('canceled') ||
    message.includes('abort') ||
    name === 'GenerationCancelledError'
  ) {
    return 'CANCELLED'
  }

  // Transient errors - these are retryable
  const transientPatterns = [
    // Rate limiting
    'rate limit',
    '429',
    'too many requests',
    'concurrency limit',

    // Network/connection issues
    'timeout',
    'timed out',
    'econnrefused',
    'connection refused',
    'network',
    'socket',
    'disconnect',
    'unreachable',

    // Provider temporarily unavailable
    '503',
    '502',
    '504',
    'service unavailable',
    'bad gateway',
    'gateway timeout',
    'overloaded',
    'maintenance',

    // RunPod specific
    'in queue',
    'pod not found',
    'gpu not available',

    // Output issues that might resolve on retry
    'output_timeout',
    'no outputs',
  ]

  if (transientPatterns.some((pattern) => message.includes(pattern))) {
    return 'TRANSIENT'
  }

  // Everything else is permanent (bad workflow, auth failure, invalid inputs, etc.)
  return 'PERMANENT'
}

/**
 * Calculate delay for retry attempt using exponential backoff with jitter
 */
export function calculateRetryDelay(
  attemptNumber: number,
  config: Partial<RetryConfig> = {}
): number {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config }

  // Exponential: base * 2^attempt
  const exponentialDelay = fullConfig.baseDelayMs * Math.pow(2, attemptNumber - 1)

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, fullConfig.maxDelayMs)

  // Add jitter (± jitterFactor)
  const jitter = (Math.random() - 0.5) * 2 * fullConfig.jitterFactor * cappedDelay

  return Math.floor(cappedDelay + jitter)
}

/**
 * Check if a job should be auto-retried
 */
export function shouldAutoRetry(
  currentAttempt: number,
  error: Error | string | null,
  config: Partial<RetryConfig> = {}
): { shouldRetry: boolean; delayMs: number; reason?: string } {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  const classification = classifyError(error)

  if (classification === 'CANCELLED') {
    return { shouldRetry: false, delayMs: 0, reason: 'Job was cancelled' }
  }

  if (classification === 'PERMANENT') {
    return { shouldRetry: false, delayMs: 0, reason: 'Permanent failure - not retryable' }
  }

  if (currentAttempt >= fullConfig.maxAutoRetries) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: `Max auto-retries (${fullConfig.maxAutoRetries}) reached`,
    }
  }

  const delayMs = calculateRetryDelay(currentAttempt + 1, fullConfig)
  return { shouldRetry: true, delayMs }
}

/**
 * Sleep utility for delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
