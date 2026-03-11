export const MAX_MODEL_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024
export const MODEL_BUCKET_SFW = 'models'
export const MODEL_BUCKET_NSFW = 'models-nsfw'

export const ALLOWED_MODEL_TYPES = new Set(['checkpoint', 'lora', 'vae'])
export const ALLOWED_MODEL_EXTENSIONS = new Set(['safetensors', 'ckpt', 'pt'])

export type ModelType = 'checkpoint' | 'lora' | 'vae'
export type ClassifierLabel = 'SFW' | 'NSFW-mild' | 'NSFW-explicit' | 'UNCERTAIN'

export type ClassifierResult = {
  label: ClassifierLabel
  score: number
  isNsfw: boolean
  requiredVerificationLevel: 0 | 1 | 2
}

export function normalizeModelType(value: unknown): ModelType {
  const parsed = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (parsed === 'lora' || parsed === 'vae') return parsed
  return 'checkpoint'
}

export function parseModelExtension(filename: string) {
  const dot = filename.lastIndexOf('.')
  if (dot < 0 || dot === filename.length - 1) return ''
  return filename.slice(dot + 1).toLowerCase()
}

export function sanitizeModelName(raw: string) {
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9\-_.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120)
}

export function buildModelStoragePath(opts: {
  rootPrefix: string
  type: ModelType
  userId: string
  modelName: string
  extension: string
}) {
  return `${opts.rootPrefix}/${opts.type}/${opts.userId}/${opts.modelName}.${opts.extension}`
}

export function classifierLevel(label: ClassifierLabel): 0 | 1 | 2 {
  if (label === 'NSFW-mild') return 1
  if (label === 'NSFW-explicit' || label === 'UNCERTAIN') return 2
  return 0
}

export function classifyModelStub(opts: {
  fileName: string
  modelName: string
  creatorMarkedNsfw: boolean
}): ClassifierResult {
  const basis = `${opts.fileName} ${opts.modelName}`.toLowerCase()
  const explicitHint = /(explicit|hardcore|porn|xxx|fetish|nude)/.test(basis)
  const uncertainHint = /(unknown|uncertain|review)/.test(basis)

  let label: ClassifierLabel = 'SFW'
  let score = 0.08

  if (opts.creatorMarkedNsfw && explicitHint) {
    label = 'NSFW-explicit'
    score = 0.96
  } else if (opts.creatorMarkedNsfw && uncertainHint) {
    label = 'UNCERTAIN'
    score = 0.51
  } else if (opts.creatorMarkedNsfw) {
    label = 'NSFW-mild'
    score = 0.72
  } else if (explicitHint) {
    label = 'UNCERTAIN'
    score = 0.58
  }

  const requiredVerificationLevel = classifierLevel(label)

  return {
    label,
    score,
    isNsfw: label !== 'SFW',
    requiredVerificationLevel,
  }
}

export function needsHumanReview(result: ClassifierResult) {
  return result.label === 'UNCERTAIN' || result.label === 'NSFW-explicit'
}
