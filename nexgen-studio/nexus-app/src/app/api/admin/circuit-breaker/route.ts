import { NextResponse } from 'next/server'
import { requireAppSession, requireAdminRole } from '@/server/auth/session'
import {
  getAllCircuitStatus,
  resetCircuit,
} from '../../../../../server/worker/core/circuitBreaker'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/circuit-breaker - Get circuit breaker status for all providers
 * Returns array of circuit states for monitoring
 */
export async function GET() {
  const session = await requireAppSession()
  await requireAdminRole(session)

  try {
    const circuits = getAllCircuitStatus()

    return NextResponse.json({
      circuits,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Circuit breaker status error:', error)
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to fetch circuit status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/circuit-breaker - Reset a circuit breaker
 * Body: { provider: string }
 */
export async function POST(request: Request) {
  const session = await requireAppSession()
  await requireAdminRole(session)

  try {
    const body = await request.json()
    const { provider } = body

    if (!provider || typeof provider !== 'string') {
      return NextResponse.json(
        { detail: 'Provider key required' },
        { status: 400 }
      )
    }

    resetCircuit(provider)

    return NextResponse.json({
      success: true,
      message: `Circuit breaker reset for ${provider}`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Circuit breaker reset error:', error)
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to reset circuit' },
      { status: 500 }
    )
  }
}
