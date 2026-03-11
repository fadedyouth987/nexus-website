import { NextResponse } from 'next/server'
import { getServerSupabase, requireUser } from '@/lib/server/v2Access'
import { getUserVerificationLevel, hashOtp, normalizePhoneE164 } from '@/lib/server/verification'

type OtpRow = {
  id: string
  phone_e164: string
  otp_hash: string
  attempts: number
  expires_at: string
  created_at: string
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request)
    const supabase = await getServerSupabase(request)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ detail: 'Invalid JSON payload' }, { status: 400 })
    }

    const payload =
      body && typeof body === 'object' && !Array.isArray(body)
        ? (body as { phone?: string; code?: string })
        : {}

    const phone = normalizePhoneE164(typeof payload.phone === 'string' ? payload.phone : '')
    const code = typeof payload.code === 'string' ? payload.code.trim() : ''
    if (!phone || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ detail: 'phone and 6-digit code are required' }, { status: 400 })
    }

    const { data: row, error: rowError } = await supabase
      .from('sms_otp_codes')
      .select('id, phone_e164, otp_hash, attempts, expires_at, created_at')
      .eq('user_id', user.userId)
      .eq('phone_e164', phone)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const otpRow = (row || null) as OtpRow | null

    if (rowError) {
      return NextResponse.json({ detail: rowError.message || 'Failed to load OTP' }, { status: 500 })
    }
    if (!otpRow) {
      return NextResponse.json({ detail: 'No pending OTP found' }, { status: 400 })
    }

    if (otpRow.attempts >= 5) {
      return NextResponse.json({ detail: 'Too many failed attempts' }, { status: 429 })
    }

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      await supabase.from('sms_otp_codes').delete().eq('id', otpRow.id)
      return NextResponse.json({ detail: 'OTP expired' }, { status: 400 })
    }

    const expectedHash = hashOtp({
      code,
      userId: user.userId,
      phone,
    })

    if (expectedHash !== otpRow.otp_hash) {
      await supabase
        .from('sms_otp_codes')
        .update({ attempts: otpRow.attempts + 1 })
        .eq('id', otpRow.id)

      return NextResponse.json({ detail: 'Invalid OTP code' }, { status: 400 })
    }

    const { error: verificationError } = await supabase.from('user_verifications').insert({
      user_id: user.userId,
      level: 1,
      provider: 'sms-otp',
      provider_ref: `${phone}:${otpRow.id}`,
      status: 'VERIFIED',
    })

    if (verificationError) {
      return NextResponse.json(
        { detail: verificationError.message || 'Failed to write verification record' },
        { status: 500 }
      )
    }

    await supabase.from('sms_otp_codes').delete().eq('id', otpRow.id)

    const level = await getUserVerificationLevel(supabase)

    return NextResponse.json({
      verified: true,
      level,
      phone,
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to verify OTP' },
      { status }
    )
  }
}
