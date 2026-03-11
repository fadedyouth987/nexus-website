/**
 * ComfyUI Headless client (RunPod A100).
 * Use submitWorkflow → waitForJob → downloadAsset(s) for the full pipeline.
 */

export {
  submitWorkflow,
  getHistory,
  waitForJob,
  getOutputAssetsFromHistory,
  downloadAsset,
  downloadAllAssets,
} from '@/lib/comfyui/client'
export type { ComfyUIWorkflow, ComfyUIOutputAsset } from '@/lib/comfyui/types'
