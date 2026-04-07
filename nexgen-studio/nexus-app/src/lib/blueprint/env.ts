/**
 * Blueprint Environment Configuration
 *
 * READ MODEL (BLUEPRINT_READ_MODEL):
 * - 'exec'   : Use generation_jobs/generated_assets (DEFAULT) - source of truth
 * - 'legacy' : DEPRECATED - Use legacy generations/assets tables
 *
 * MIGRATION GUIDANCE:
 * - Setting BLUEPRINT_READ_MODEL=legacy is DEPRECATED and will be removed in v2
 * - All new code should use 'exec' mode (default since v1.5)
 * - Legacy tables are maintained as read mirrors only (BLUEPRINT_MIRROR_LEGACY=1)
 *
 * REMOVAL TIMELINE:
 * - v1.5: 'exec' is default, 'legacy' supported for backward compat
 * - v2.0: 'legacy' mode will be removed entirely
 */
export type BlueprintReadModel = 'legacy' | 'exec'

export function getBlueprintReadModel(): BlueprintReadModel {
  const value = process.env.BLUEPRINT_READ_MODEL || 'exec' // Default to exec since v1.5

  if (value === 'legacy') {
    console.warn(
      '[DEPRECATION] BLUEPRINT_READ_MODEL=legacy is deprecated and will be removed in v2.0. ' +
        'Migrate to exec mode (default). See migration guide: https://docs.nexgen.studio/migrations/v2'
    )
  }

  if (value !== 'legacy' && value !== 'exec') {
    throw new Error('Invalid BLUEPRINT_READ_MODEL: must be "legacy" or "exec"')
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
