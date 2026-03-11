import { NextResponse } from 'next/server'
import { getServerSupabase, requireUser } from '@/lib/server/v2Access'
import { getUserVerificationLevel } from '@/lib/server/verification'

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value || '')
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return Math.floor(parsed)
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request)
    const supabase = await getServerSupabase(request)
    const { searchParams } = new URL(request.url)

    const page = parsePositiveInt(searchParams.get('page'), 1)
    const pageSize = Math.min(100, parsePositiveInt(searchParams.get('page_size'), 20))
    const offset = (page - 1) * pageSize

    const type = (searchParams.get('type') || '').trim().toLowerCase()
    const status = (searchParams.get('status') || '').trim().toUpperCase()

    const fullSelect =
      'id, name, type, file_path, file_size, is_nsfw, required_verification_level, status, meta_json, created_at'
    const fallbackSelect =
      'id, name, type, file_path, file_size, status, meta_json, created_at'

    const runQuery = (selectClause: string) => {
      let query = supabase
        .from('models')
        .select(selectClause, { count: 'exact' })
        .eq('user_id', user.userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1)

      if (type) {
        query = query.eq('type', type)
      }
      if (status) {
        query = query.eq('status', status)
      }
      return query
    }

    let result = await runQuery(fullSelect)
    if (result.error) {
      const msg = result.error.message || ''
      if (msg.includes('is_nsfw') || msg.includes('required_verification_level') || msg.includes('does not exist')) {
        result = await runQuery(fallbackSelect)
      }
    }

    const { data, error, count } = result
    if (error) {
      return NextResponse.json({
        items: [],
        pagination: { page, page_size: pageSize, total: 0 },
        userVerificationLevel: 0,
        ...(process.env.NODE_ENV !== 'production' && { detail: error.message }),
      })
    }

    const rows = Array.isArray(data) ? (data as unknown as Record<string, unknown>[]) : []
    const items = rows.map((row: Record<string, unknown>) => ({
      ...row,
      is_nsfw: 'is_nsfw' in row ? row.is_nsfw : false,
      required_verification_level: 'required_verification_level' in row ? row.required_verification_level : 0,
    }))

    let userVerificationLevel = 0
    try {
      userVerificationLevel = await getUserVerificationLevel(supabase)
    } catch {
      // RPC may not exist yet; use 0
    }
    return NextResponse.json({
      items,
      pagination: {
        page,
        page_size: pageSize,
        total: count || 0,
      },
      userVerificationLevel,
    })
  } catch (error) {
    const err = error as Error & { status?: number }
    const status = typeof err.status === 'number' ? err.status : 500
    const message = err instanceof Error ? err.message : 'Failed to load models'
    if (status === 401 || status === 403) {
      return NextResponse.json({ detail: message }, { status })
    }
    return NextResponse.json({
      items: [],
      pagination: { page: 1, page_size: 20, total: 0 },
      userVerificationLevel: 0,
      detail: message,
    })
  }
}
