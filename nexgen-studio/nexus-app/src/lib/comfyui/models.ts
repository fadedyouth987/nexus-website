/**
 * Model registry for ComfyUI workflows.
 * Paths are relative to ComfyUI root on the RunPod container (e.g. /runpod-volume/ComfyUI/).
 * Custom checkpoints can be added at runtime or via env.
 */

export type ModelKind = 'checkpoint' | 'vae' | 'lora' | 'controlnet' | 'video'

export interface ModelConfig {
  id: string
  name: string
  kind: ModelKind
  /** Path relative to ComfyUI base (e.g. models/checkpoints/...) */
  path: string
  /** Optional display label */
  label?: string
}

export interface FullModelSet {
  checkpoint: string
  vae?: string
  controlnet?: string[]
  loras?: Array<{ path: string; strength?: number }>
  /** AnimateDiff motion module filename or path */
  motion_module?: string
}

/** Known model IDs used in workflow templates */
export type KnownModelId =
  | 'sd1'
  | 'sd15'
  | 'sdxl'
  | 'flux'
  | 'sd15_vae'
  | 'sdxl_vae'
  | 'flux_vae'
  | 'kling'
  | 'nano'
  | 'banana'
  | 'custom'

const BASE = process.env.COMFYUI_MODELS_BASE ?? 'models'

const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // Stable Diffusion 1.x
  sd1: {
    id: 'sd1',
    name: 'Stable Diffusion 1.x',
    kind: 'checkpoint',
    path: `${BASE}/checkpoints/sd_v1-5.ckpt`,
    label: 'SD 1.0',
  },
  // Stable Diffusion 1.5
  sd15: {
    id: 'sd15',
    name: 'Stable Diffusion 1.5',
    kind: 'checkpoint',
    path: `${BASE}/checkpoints/v1-5-pruned-ema.safetensors`,
    label: 'SD 1.5',
  },
  sd15_vae: {
    id: 'sd15_vae',
    name: 'SD 1.5 VAE',
    kind: 'vae',
    path: `${BASE}/vae/sd15.vae.pt`,
  },
  // SDXL
  sdxl: {
    id: 'sdxl',
    name: 'Stable Diffusion XL',
    kind: 'checkpoint',
    path: `${BASE}/checkpoints/sd_xl_base_1.0.safetensors`,
    label: 'SDXL',
  },
  sdxl_vae: {
    id: 'sdxl_vae',
    name: 'SDXL VAE',
    kind: 'vae',
    path: `${BASE}/vae/sdxl_vae.safetensors`,
  },
  // FLUX
  flux: {
    id: 'flux',
    name: 'FLUX.1',
    kind: 'checkpoint',
    path: `${BASE}/checkpoints/flux1-dev.safetensors`,
    label: 'FLUX',
  },
  flux_vae: {
    id: 'flux_vae',
    name: 'FLUX VAE',
    kind: 'vae',
    path: `${BASE}/vae/ae.safetensors`,
  },
  // Video models (paths are placeholders; mount real paths on RunPod)
  kling: {
    id: 'kling',
    name: 'Kling Video',
    kind: 'checkpoint',
    path: `${BASE}/checkpoints/kling`,
    label: 'Kling',
  },
  nano: {
    id: 'nano',
    name: 'Nano Video',
    kind: 'checkpoint',
    path: `${BASE}/checkpoints/nano`,
    label: 'Nano',
  },
  banana: {
    id: 'banana',
    name: 'Banana Video',
    kind: 'checkpoint',
    path: `${BASE}/checkpoints/banana`,
    label: 'Banana',
  },
  // ControlNet
  controlnet_openpose: {
    id: 'controlnet_openpose',
    name: 'ControlNet OpenPose',
    kind: 'controlnet',
    path: `${BASE}/controlnet/control_v11p_sd15_openpose.pth`,
  },
  controlnet_canny: {
    id: 'controlnet_canny',
    name: 'ControlNet Canny',
    kind: 'controlnet',
    path: `${BASE}/controlnet/control_v11p_sd15_canny.pth`,
  },
  // AnimateDiff motion module (SDXL)
  animatediff_motion: {
    id: 'animatediff_motion',
    name: 'AnimateDiff Motion Module',
    kind: 'checkpoint',
    path: `${BASE}/animatediff_models/mm_sdxl_v10_beta.pt`,
    label: 'AnimateDiff SDXL',
  },
}

/**
 * Get a single model config by ID.
 */
export function getModelConfig(modelId: string): ModelConfig | null {
  return MODEL_REGISTRY[modelId] ?? null
}

/**
 * Get full model set for a known pipeline (checkpoint + vae + optional controlnet).
 */
export function getModelSet(modelName: KnownModelId): FullModelSet {
  const sets: Record<KnownModelId, FullModelSet> = {
    sd1: {
      checkpoint: getModelConfig('sd1')?.path ?? `${BASE}/checkpoints/sd_v1-5.ckpt`,
      vae: getModelConfig('sd15_vae')?.path,
      controlnet: [getModelConfig('controlnet_openpose')?.path].filter(Boolean) as string[],
    },
    sd15: {
      checkpoint: getModelConfig('sd15')?.path ?? `${BASE}/checkpoints/v1-5-pruned-ema.safetensors`,
      vae: getModelConfig('sd15_vae')?.path,
      controlnet: [getModelConfig('controlnet_openpose')?.path].filter(Boolean) as string[],
    },
    sdxl: {
      checkpoint: getModelConfig('sdxl')?.path ?? `${BASE}/checkpoints/sd_xl_base_1.0.safetensors`,
      vae: getModelConfig('sdxl_vae')?.path,
      controlnet: [],
      motion_module: getModelConfig('animatediff_motion')?.path,
    },
    flux: {
      checkpoint: getModelConfig('flux')?.path ?? `${BASE}/checkpoints/flux1-dev.safetensors`,
      vae: getModelConfig('flux_vae')?.path,
    },
    kling: {
      checkpoint: getModelConfig('kling')?.path ?? `${BASE}/checkpoints/kling`,
    },
    nano: {
      checkpoint: getModelConfig('nano')?.path ?? `${BASE}/checkpoints/nano`,
    },
    banana: {
      checkpoint: getModelConfig('banana')?.path ?? `${BASE}/checkpoints/banana`,
    },
    sd15_vae: {
      checkpoint: getModelConfig('sd15')?.path ?? '',
      vae: getModelConfig('sd15_vae')?.path,
    },
    sdxl_vae: {
      checkpoint: getModelConfig('sdxl')?.path ?? '',
      vae: getModelConfig('sdxl_vae')?.path,
    },
    flux_vae: {
      checkpoint: getModelConfig('flux')?.path ?? '',
      vae: getModelConfig('flux_vae')?.path,
    },
    custom: {
      checkpoint: '',
    },
  }
  return sets[modelName] ?? sets.custom
}

/**
 * List all registered models (e.g. for UI dropdown).
 */
export function listModels(kind?: ModelKind): ModelConfig[] {
  const list = Object.values(MODEL_REGISTRY)
  return kind ? list.filter((m) => m.kind === kind) : list
}

/**
 * Register a custom model at runtime (e.g. from DB or env).
 */
export function registerModel(config: ModelConfig): void {
  MODEL_REGISTRY[config.id] = config
}
