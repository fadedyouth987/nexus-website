/**
 * Model registry for ComfyUI (Kling, Nano, Banana, SD, SDXL, custom).
 * Re-exports from comfyui/models for backward compatibility.
 */

export {
  getModelConfig,
  getModelSet,
  listModels,
  registerModel,
  type ModelConfig,
  type ModelKind,
  type FullModelSet,
  type KnownModelId,
} from '@/lib/comfyui/models'
