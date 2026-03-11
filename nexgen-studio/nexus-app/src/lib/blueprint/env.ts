export type BlueprintReadModel = 'legacy' | 'exec'

export function getBlueprintReadModel(): BlueprintReadModel {
  const value = process.env.BLUEPRINT_READ_MODEL || 'legacy'
  if (value !== 'legacy' && value !== 'exec') {
    throw new Error('Invalid BLUEPRINT_READ_MODEL')
  }
  return value
}

export function isBlueprintMirrorEnabled() {
  return process.env.BLUEPRINT_MIRROR_LEGACY === '1'
}

export function isBlueprintExecEnabled() {
  return getBlueprintReadModel() === 'exec'
}

export function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}
