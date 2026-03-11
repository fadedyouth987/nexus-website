import { NextResponse } from 'next/server'
import { getServerSupabase, requireUser } from '@/lib/server/v2Access'
import { generateOtpCode, hashOtp, normalizePhoneE164 } from '@/lib/server/verification'

function smsProviderConfig() {
  return {
    url: process.env.SMS_PROVIDER_URL || '',
    apiKey: process.env.SMS_PROVIDER_API_KEY || '',
    sender: process.env.SMS_SENDER_ID || 'NEXUS',
  }
}

async function sendOtpSms(phone: string, otp: string) {
  const cfg = smsProviderConfig()
  if (!cfg.url || !cfg.apiKey) {
    console.warn(`[sms-otp] provider not configured; otp generated for ${phone}`)
    return { provider: 'stub', messageId: null as string | null }
  }

  const response = await fetch(cfg.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: phone,
      from: cfg.sender,
      message: `Your verification code is ${otp}. It expires in 10 minutes.`,
    }),
  })

  if (!response.ok) {
    throw new Error(`SMS provider send failed: ${response.status}`)
  }

  const payload = (await response.json()) as { id?: string; message_id?: string }
  return {
    provider: 'external',
    messageId: payload.message_id || payload.id || null,
  }
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

    const phoneRaw =
      body && typeof body === 'object' && !Array.isArray(body) && typeof (body as { phone?: unknown }).phone === 'string'
        ? String((body as { phone: string }).phone)
        : ''
    const phone = normalizePhoneE164(phoneRaw)
    if (!phone) {
      return NextResponse.json({ detail: 'phone must be a valid E.164 number' }, { status: 400 })
    }

    const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { data: recentRows, error: recentError } = await supabase
      .from('sms_otp_codes')
      .select('id')
      .eq('phone_e164', phone)
      .gte('created_at', oneHourAgoIso)

    if (recentError) {
      return NextResponse.json({ detail: recentError.message || 'Failed to check rate limit' }, { status: 500 })
    }

    if ((recentRows || []).length >= 3) {
      return NextResponse.json({ detail: 'Too many OTP sends. Try again later.' }, { status: 429 })
    }

    const otp = generateOtpCode()
    const otpHash = hashOtp({
      code: otp,
      userId: user.userId,
      phone,
    })
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { data: inserted, error: insertError } = await supabase
      .from('sms_otp_codes')
      .insert({
        user_id: user.userId,
        phone_e164: phone,
        otp_hash: otpHash,
        attempts: 0,
        send_attempt: (recentRows || []).length + 1,
        expires_at: expiresAt,
      })
      .select('id, expires_at')
      .single()

    if (insertError || !inserted) {
      return NextResponse.json(
        { detail: insertError?.message || 'Failed to create OTP' },
        { status: 500 }
      )
    }

    const sent = await sendOtpSms(phone, otp)

    return NextResponse.json({
      sent: true,
      phone,
      expiresAt: inserted.expires_at,
      provider: sent.provider,
    })
  } catch (error) {
    const status =
      typeof (error as { status?: number }).status === 'number'
        ? (error as { status: number }).status
        : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to send OTP' },
      { status }
    )
  }
}
