import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

const ALG = 'aes-256-gcm'
const KEY_LEN = 32
const IV_LEN = 16
const AUTH_TAG_LEN = 16
const SALT_LEN = 16

function getEncryptionKey(): Buffer {
  const secret = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY or NEXTAUTH_SECRET required for token encryption')
  return scryptSync(secret, 'nexgen-social', KEY_LEN)
}

export function encryptToken(plain: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALG, key, iv)
  let enc = cipher.update(plain, 'utf8', 'hex')
  enc += cipher.final('hex')
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc}`
}

export function decryptToken(encrypted: string): string {
  const key = getEncryptionKey()
  const parts = encrypted.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted token format')
  const [ivHex, tagHex, enc] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const decipher = createDecipheriv(ALG, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(enc, 'hex', 'utf8') + decipher.final('utf8')
}
