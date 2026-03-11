import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/adminGuard'

export async function GET(request: Request) {
  try {
    await requireAdmin(request)
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401
    return NextResponse.json({ detail: (e as Error).message }, { status })
  }
  return NextResponse.json([])
}
