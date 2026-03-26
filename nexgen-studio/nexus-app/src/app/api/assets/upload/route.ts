import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rule = RATE_LIMITS['/api/assets/upload']
  const rl = await checkRateLimit(`upload:${session.user.id}`, rule)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter }, { status: 429 })
  }

  return NextResponse.json(
    { detail: 'Use server action uploadAsset or implement multipart upload here.' },
    { status: 501 }
  )
}
