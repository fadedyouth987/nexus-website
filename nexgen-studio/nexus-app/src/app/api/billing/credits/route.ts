import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

type CreditLedgerRow = { delta: number | string | null }

export async function GET(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })
  if (!token?.sub) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const userId = token.sub

  try {
    const admin = getEngineSupabaseAdmin()
    const { data, error } = await admin
      .from('credit_ledger')
      .select('delta')
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json(
        { detail: error.message || 'Failed to load credits' },
        { status: 500 }
      )
    }

    const rows = (data ?? []) as CreditLedgerRow[]
    const balance = rows.reduce((sum, row) => sum + Number(row.delta ?? 0), 0)
    return NextResponse.json({ balance: Math.floor(balance) })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load credits'
    return NextResponse.json({ detail: message }, { status: 500 })
  }
}
