export interface LoRASetting {
  id: string
  name: string
  path: string
  strength: number
  enabled: boolean
}

export interface GenerationSettings {
  checkpoint: string
  vae: string
  steps: number
  cfg: number
  sampler: string
  scheduler: string
  seed: number
  denoise: number
  loras: LoRASetting[]
  controlnetEnabled: boolean
  controlnetModel: string
  controlnetPreprocessor: string
  controlnetStrength: number
  width: number
  height: number
  batchSize: number
  clipSkip: number
  highresFix: boolean
  hrScale: number
  hrSteps: number
  hrDenoise: number
  saveToGallery: boolean
  randomSeedAfterGen: boolean
}

export const defaultGenerationSettings: GenerationSettings = {
  checkpoint: 'sd15',
  vae: 'Auto',
  steps: 20,
  cfg: 7,
  sampler: 'euler',
  scheduler: 'normal',
  seed: -1,
  denoise: 1,
  loras: [],
  controlnetEnabled: false,
  controlnetModel: '',
  controlnetPreprocessor: 'none',
  controlnetStrength: 1,
  width: 512,
  height: 512,
  batchSize: 1,
  clipSkip: 1,
  highresFix: false,
  hrScale: 2,
  hrSteps: 20,
  hrDenoise: 0.3,
  saveToGallery: true,
  randomSeedAfterGen: false,
}

export function mergeGenerationSettings(input: Partial<GenerationSettings> | null | undefined): GenerationSettings {
  return {
    ...defaultGenerationSettings,
    ...(input ?? {}),
  }
}
