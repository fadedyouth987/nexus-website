export type LoRASetting = {
  id: string
  name: string
  path: string
  strength: number
  enabled: boolean
}

export type GenerationSettings = {
  checkpoint: string
  vae: string
  width: number
  height: number
  steps: number
  cfg: number
  seed: number
  sampler: string
  scheduler: string
  denoise: number
  batchSize: number
  loras: LoRASetting[]
  controlnetEnabled: boolean
  controlnetModel: string
  controlnetPreprocessor: string
  controlnetStrength: number
  clipSkip: number
  highresFix: boolean
  hrScale: number
  hrSteps: number
  hrDenoise: number
  saveToGallery: boolean
  randomSeedAfterGen: boolean
  prompt: string
  negativePrompt: string
}

export const defaultGenerationSettings: GenerationSettings = {
  checkpoint: 'sd15',
  vae: 'Auto',
  width: 512,
  height: 512,
  steps: 20,
  cfg: 7,
  seed: -1,
  sampler: 'euler',
  scheduler: 'normal',
  denoise: 1,
  batchSize: 1,
  loras: [],
  controlnetEnabled: false,
  controlnetModel: 'canny',
  controlnetPreprocessor: 'canny',
  controlnetStrength: 0.8,
  clipSkip: 1,
  highresFix: false,
  hrScale: 2,
  hrSteps: 20,
  hrDenoise: 0.3,
  saveToGallery: true,
  randomSeedAfterGen: false,
  prompt: 'masterpiece, best quality',
  negativePrompt: 'worst quality, low quality',
}

const asFiniteNumber = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const asMinInt = (value: unknown, fallback: number, min: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.max(min, Math.floor(value))
}

const asRange = (value: unknown, fallback: number, min: number, max: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

export function mergeGenerationSettings(raw: unknown): GenerationSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...defaultGenerationSettings }
  }
  const o = raw as Record<string, unknown>
  const loras = Array.isArray(o.loras)
    ? (o.loras as unknown[])
        .filter((x): x is LoRASetting =>
          Boolean(x && typeof x === 'object' && 'id' in (x as object) && 'path' in (x as object))
        )
        .map((l) => ({
          id: String(l.id),
          name: String(l.name ?? ''),
          path: String(l.path ?? ''),
          strength:
            typeof l.strength === 'number' && Number.isFinite(l.strength)
              ? Math.min(2, Math.max(0, l.strength))
              : 0.8,
          enabled: typeof l.enabled === 'boolean' ? l.enabled : true,
        }))
    : defaultGenerationSettings.loras

  return {
    ...defaultGenerationSettings,
    checkpoint: typeof o.checkpoint === 'string' ? o.checkpoint : defaultGenerationSettings.checkpoint,
    vae: typeof o.vae === 'string' ? o.vae : defaultGenerationSettings.vae,
    width: asMinInt(o.width, defaultGenerationSettings.width, 64),
    height: asMinInt(o.height, defaultGenerationSettings.height, 64),
    steps: asMinInt(o.steps, defaultGenerationSettings.steps, 1),
    cfg: asRange(o.cfg, defaultGenerationSettings.cfg, 0, 30),
    seed: asFiniteNumber(o.seed, defaultGenerationSettings.seed),
    sampler: typeof o.sampler === 'string' ? o.sampler : defaultGenerationSettings.sampler,
    scheduler: typeof o.scheduler === 'string' ? o.scheduler : defaultGenerationSettings.scheduler,
    denoise: asRange(o.denoise, defaultGenerationSettings.denoise, 0, 1),
    batchSize: asMinInt(o.batchSize, defaultGenerationSettings.batchSize, 1),
    loras,
    controlnetEnabled:
      typeof o.controlnetEnabled === 'boolean' ? o.controlnetEnabled : defaultGenerationSettings.controlnetEnabled,
    controlnetModel:
      typeof o.controlnetModel === 'string' ? o.controlnetModel : defaultGenerationSettings.controlnetModel,
    controlnetPreprocessor:
      typeof o.controlnetPreprocessor === 'string'
        ? o.controlnetPreprocessor
        : defaultGenerationSettings.controlnetPreprocessor,
    controlnetStrength: asRange(o.controlnetStrength, defaultGenerationSettings.controlnetStrength, 0, 2),
    clipSkip: asMinInt(o.clipSkip, defaultGenerationSettings.clipSkip, 1),
    highresFix: typeof o.highresFix === 'boolean' ? o.highresFix : defaultGenerationSettings.highresFix,
    hrScale: asRange(o.hrScale, defaultGenerationSettings.hrScale, 1, 4),
    hrSteps: asMinInt(o.hrSteps, defaultGenerationSettings.hrSteps, 1),
    hrDenoise: asRange(o.hrDenoise, defaultGenerationSettings.hrDenoise, 0, 1),
    saveToGallery: typeof o.saveToGallery === 'boolean' ? o.saveToGallery : defaultGenerationSettings.saveToGallery,
    randomSeedAfterGen:
      typeof o.randomSeedAfterGen === 'boolean' ? o.randomSeedAfterGen : defaultGenerationSettings.randomSeedAfterGen,
    prompt: typeof o.prompt === 'string' ? o.prompt : defaultGenerationSettings.prompt,
    negativePrompt: typeof o.negativePrompt === 'string' ? o.negativePrompt : defaultGenerationSettings.negativePrompt,
  }
}

