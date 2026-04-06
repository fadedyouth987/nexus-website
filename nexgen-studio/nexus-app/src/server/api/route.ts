import { NextResponse } from 'next/server'
import { ZodError, type ZodSchema } from 'zod'

export async function parseJsonBody<T>(request: Request, schema: ZodSchema<T>) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    throw createApiError(400, 'Invalid JSON payload')
  }

  const parsed = schema.safeParse(payload)

  if (!parsed.success) {
    throw createApiError(400, 'Invalid request body', parsed.error.flatten())
  }

  return parsed.data
}

export function createApiError(status: number, message: string, details?: unknown) {
  return Object.assign(new Error(message), { status, details })
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { detail: 'Invalid request payload', issues: error.flatten() },
      { status: 400 }
    )
  }

  const status = typeof (error as { status?: number }).status === 'number'
    ? (error as { status: number }).status
    : 500

  const detail = error instanceof Error ? error.message : 'Unexpected server error'
  const details = (error as { details?: unknown }).details

  return NextResponse.json({ detail, details }, { status })
}
