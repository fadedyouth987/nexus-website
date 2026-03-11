import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const verified = cookieStore.get('age_verified_18')?.value === 'true'
  return NextResponse.json({ verified })
}

export async function POST(request: Request) {
  const body = (await request.json()) as { dob?: string }
  const dob = body?.dob
  if (!dob) {
    return NextResponse.json({ error: 'DOB is required' }, { status: 400 })
  }

  const parsed = new Date(dob)
  if (Number.isNaN(parsed.getTime())) {
    return NextResponse.json({ error: 'Invalid DOB' }, { status: 400 })
  }

  const now = new Date()
  const minDate = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate())
  if (parsed > minDate) {
    return NextResponse.json({ error: 'Must be 18+' }, { status: 403 })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set('age_verified_18', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set('age_verified_18', '', {
    path: '/',
    maxAge: 0,
  })
  return response
}
