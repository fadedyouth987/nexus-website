import { getToken } from 'next-auth/jwt'

/**
 * Require the request to be from an admin user.
 * Uses ADMIN_USER_IDS env (comma-separated user ids) or falls back to any authenticated user in dev.
 */
export async function requireAdmin(request: Request): Promise<{ userId: string }> {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET,
  })
  if (!token?.sub) {
    const error = new Error('Unauthorized')
    ;(error as Error & { status?: number }).status = 401
    throw error
  }
  const adminIds = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (adminIds.length > 0 && !adminIds.includes(token.sub)) {
    const error = new Error('Forbidden')
    ;(error as Error & { status?: number }).status = 403
    throw error
  }
  return { userId: token.sub }
}
