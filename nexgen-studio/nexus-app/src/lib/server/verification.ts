import crypto from 'node:crypto'

function otpPepper() {
  return process.env.SMS_OTP_PEPPER || ''
}

export function normalizePhoneE164(input: string) {
  const value = input.trim()
  if (!/^\+[1-9]\d{7,14}$/.test(value)) {
    return null
  }
  return value
}

export function generateOtpCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
}

export function hashOtp(input: { code: string; userId: string; phone: string }) {
  return crypto
    .createHash('sha256')
    .update(`${input.code}:${input.userId}:${input.phone}:${otpPepper()}`)
    .digest('hex')
}

export async function getUserVerificationLevel(supabase: any) {
  const { data, error } = await supabase.rpc('user_verification_level')
  if (error) {
    throw new Error(error.message || 'Failed to resolve verification level')
  }

  const level = Number(data || 0)
  if (!Number.isFinite(level)) return 0
  return Math.max(0, Math.floor(level))
}
