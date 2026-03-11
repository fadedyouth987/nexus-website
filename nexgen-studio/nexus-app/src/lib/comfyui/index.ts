/**
 * ComfyUI Headless client.
 * Supports both direct ComfyUI connection and RunPod Serverless API.
 *
 * Direct mode: Use submitWorkflow → waitForJob → downloadAsset(s)
 * RunPod mode: Use submitRunPodJob → waitForRunPodJob → downloadRunPodAsset(s)
 */

// Direct ComfyUI connection
export {
  submitWorkflow,
  getHistory,
  waitForJob,
  getOutputAssetsFromHistory,
  downloadAsset,
  downloadAllAssets,
} from '@/lib/comfyui/client'

// RunPod Serverless API
export {
  submitRunPodJob,
  getRunPodJobStatus,
  waitForRunPodJob,
  convertRunPodOutputToAssets,
  downloadRunPodAsset,
  runPodGenerate,
} from '@/lib/comfyui/runpod'

// Unified generator (auto-detects backend)
export {
  generate,
  detectBackend,
  getJobStatus,
} from '@/lib/comfyui/generator'
export type { GenerationResult, GenerationOptions, GenerationBackend } from '@/lib/comfyui/generator'

export type { ComfyUIWorkflow, ComfyUIOutputAsset } from '@/lib/comfyui/types'
