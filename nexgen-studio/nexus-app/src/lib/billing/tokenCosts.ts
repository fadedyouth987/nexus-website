export const TOKEN_COST_MATRIX = {
  generation: {
    image: 8,
    video: 45,
  },
  model: {
    validationHourlyRate: 242,
  },
  edit: {
    default: 3,
    upscale: 6,
    face_restore: 3,
    face_swap: 3,
    expression: 3,
    bg_remove: 3,
    bg_replace: 3,
    denoise: 3,
    sharpen: 3,
    color_grade: 3,
    'video-face-swap': 12,
    'video-bg': 10,
    stabilize: 8,
    subtitles: 5,
    'audio-replace': 7,
  },
  automation: {
    planner_strategy: 4,
    planner_calendar: 6,
    planner_optimize: 3,
    factory_pipeline: 15,
  },
  publishing: {
    social_publish: 1,
    social_retry: 0,
  },
  topup: {
    tokensPerPack: 100,
    usdPerPack: 5,
  },
} as const

export type TokenCostCategory = keyof typeof TOKEN_COST_MATRIX

export type TokenCostOperation = {
  operation: string
  category: TokenCostCategory | string
  label: string
  tokensPerUnit: number
  unitLabel: string
  description: string
}

export const TOKEN_COST_CATALOG: TokenCostOperation[] = [
  { operation: 'image_generation',  category: 'generation',  label: 'Image generation',      tokensPerUnit: 8,   unitLabel: 'per image',  description: 'SDXL / Flux image generation via ComfyUI' },
  { operation: 'video_generation',  category: 'generation',  label: 'Video generation',      tokensPerUnit: 45,  unitLabel: 'per clip',   description: 'Short-form video generation pipeline' },
  { operation: 'upscale',           category: 'edit',        label: 'Upscale (2x-8x)',       tokensPerUnit: 6,   unitLabel: 'per asset',  description: 'Super-resolution upscaling' },
  { operation: 'face_restore',      category: 'edit',        label: 'Face restore',           tokensPerUnit: 3,   unitLabel: 'per asset',  description: 'Face correction and clarity restoration' },
  { operation: 'face_swap',         category: 'edit',        label: 'Face swap',              tokensPerUnit: 3,   unitLabel: 'per asset',  description: 'Swap face from reference image' },
  { operation: 'expression',        category: 'edit',        label: 'Expression change',      tokensPerUnit: 3,   unitLabel: 'per asset',  description: 'Adjust facial expression and mood' },
  { operation: 'bg_remove',         category: 'edit',        label: 'Background remove',      tokensPerUnit: 3,   unitLabel: 'per asset',  description: 'Automatic background removal' },
  { operation: 'bg_replace',        category: 'edit',        label: 'Background replace',     tokensPerUnit: 3,   unitLabel: 'per asset',  description: 'Replace background with preset or custom' },
  { operation: 'denoise',           category: 'edit',        label: 'Noise reduction',        tokensPerUnit: 3,   unitLabel: 'per asset',  description: 'Reduce noise and grain' },
  { operation: 'sharpen',           category: 'edit',        label: 'Sharpen / detail',       tokensPerUnit: 3,   unitLabel: 'per asset',  description: 'Enhance sharpness and detail' },
  { operation: 'color_grade',       category: 'edit',        label: 'Color grading',          tokensPerUnit: 3,   unitLabel: 'per asset',  description: 'Adjust color, tone, and look' },
  { operation: 'video_face_swap',   category: 'edit',        label: 'Video face swap',        tokensPerUnit: 12,  unitLabel: 'per clip',   description: 'Face replacement across video frames' },
  { operation: 'video_bg',          category: 'edit',        label: 'Video background',       tokensPerUnit: 10,  unitLabel: 'per clip',   description: 'Remove or replace video background' },
  { operation: 'stabilize',         category: 'edit',        label: 'Motion stabilize',       tokensPerUnit: 8,   unitLabel: 'per clip',   description: 'Stabilize shaky footage' },
  { operation: 'subtitles',         category: 'edit',        label: 'Subtitle generation',    tokensPerUnit: 5,   unitLabel: 'per clip',   description: 'AI caption and subtitle overlay' },
  { operation: 'audio_replace',     category: 'edit',        label: 'Audio replace',          tokensPerUnit: 7,   unitLabel: 'per clip',   description: 'Replace or add audio track' },
  { operation: 'planner_strategy',  category: 'automation',  label: 'Strategy generation',    tokensPerUnit: 4,   unitLabel: 'per plan',   description: 'AI-generated 30-day content strategy' },
  { operation: 'planner_calendar',  category: 'automation',  label: 'Calendar generation',    tokensPerUnit: 6,   unitLabel: 'per plan',   description: 'Full 30-day content calendar build' },
  { operation: 'planner_optimize',  category: 'automation',  label: 'Prompt optimization',    tokensPerUnit: 3,   unitLabel: 'per run',    description: 'Analytics-driven strategy refinement' },
  { operation: 'factory_pipeline',  category: 'automation',  label: 'Factory pipeline',       tokensPerUnit: 15,  unitLabel: 'per run',    description: 'Full influencer factory pipeline' },
  { operation: 'social_publish',    category: 'publishing',  label: 'Social publish',         tokensPerUnit: 1,   unitLabel: 'per post',   description: 'Dispatch post to connected platform' },
  { operation: 'social_retry',      category: 'publishing',  label: 'Publish retry',          tokensPerUnit: 0,   unitLabel: 'per retry',  description: 'Retry failed publish (no cost)' },
  { operation: 'model_validation',  category: 'model',       label: 'Model GPU job',          tokensPerUnit: 242, unitLabel: 'per GPU-hr', description: 'Custom model validation on A100' },
]

export function estimateModelValidationTokens(expectedRuntimeSeconds: number): number {
  const runtimeHours = Math.max(0, expectedRuntimeSeconds) / 3600
  const rawTokens = runtimeHours * TOKEN_COST_MATRIX.model.validationHourlyRate
  return Math.max(1, Math.ceil(rawTokens))
}

export function estimateEditTokens(toolId: string, assetCount = 1): number {
  const perAsset =
    TOKEN_COST_MATRIX.edit[toolId as keyof typeof TOKEN_COST_MATRIX.edit] ??
    TOKEN_COST_MATRIX.edit.default
  return Math.max(1, Math.ceil(perAsset * Math.max(1, assetCount)))
}

export function resolveGenerationRunTokenCost(params: {
  type: 'IMAGE' | 'VIDEO'
  templateBaseCostCredits?: number | null
}): number {
  const configured = Number(params.templateBaseCostCredits ?? 0)
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(1, Math.ceil(configured))
  }
  return params.type === 'VIDEO' ? TOKEN_COST_MATRIX.generation.video : TOKEN_COST_MATRIX.generation.image
}

