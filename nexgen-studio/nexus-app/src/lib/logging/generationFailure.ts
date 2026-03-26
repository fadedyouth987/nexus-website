/**
 * Minimal structured logs for generation pipeline failures (no external APM).
 * One JSON line per event on stderr for grep/correlation.
 */

export const GENERATION_WORKFLOW = 'txt2img' as const
export const GENERATION_PROVIDER_COMFY = 'comfyui' as const
export const GENERATION_PROVIDER_API = 'api' as const

export function getRequestId(request: Request): string {
  const fromHeader =
    request.headers.get('x-request-id')?.trim() ||
    request.headers.get('x-vercel-id')?.trim() ||
    ''
  if (fromHeader) return fromHeader
  return crypto.randomUUID()
}

export type GenerationFailureFields = {
  /** Defaults to `generation_failure`; use e.g. `billing_failure` for non-generation routes. */
  event?: string
  requestId?: string | null
  userId?: string | null
  /** Org id after successful membership / resolution (generate-image, worker). */
  resolvedOrgId?: string | null
  /** Raw `org_id` from query/body when access was denied (e.g. billing 403). */
  requestedOrgId?: string | null
  jobId?: string | null
  workflow?: string
  provider?: string
  code: string
  message: string
  attempt?: number
  maxAttempts?: number
}

export function logGenerationFailure(fields: GenerationFailureFields): void {
  const { event = 'generation_failure', ...rest } = fields
  const line = {
    event,
    ts: new Date().toISOString(),
    ...rest,
  }
  console.error(JSON.stringify(line))
}
