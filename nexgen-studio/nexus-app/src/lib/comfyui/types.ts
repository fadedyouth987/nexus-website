/**
 * ComfyUI Headless API types.
 * See: https://github.com/comfyanonymous/ComfyUI
 */

export type ComfyUIWorkflow = Record<string, ComfyUINode>

export interface ComfyUINode {
  class_type: string
  inputs: Record<string, unknown>
}

export interface ComfyUIPromptResponse {
  prompt_id: string
  number: number
  node_errors?: Record<string, unknown>
}

export interface ComfyUIHistoryOutputImage {
  filename: string
  subfolder: string
  type: string
}

export interface ComfyUIHistoryOutput {
  images?: ComfyUIHistoryOutputImage[]
  gifs?: Array<{ filename: string; subfolder: string; type: string }>
}

export interface ComfyUIHistoryEntry {
  prompt: [string, ComfyUIWorkflow]
  outputs: Record<string, ComfyUIHistoryOutput>
  status?: { status_str: string; completed: number; messages: [string, unknown][] }
}

export interface ComfyUIHistoryResponse {
  [promptId: string]: ComfyUIHistoryEntry
}

export interface ComfyUIQueueResponse {
  queue_running: Array<[string, number]>
  queue_pending: Array<[string, number]>
}

export type ComfyUIOutputType = 'image' | 'video'

export interface ComfyUIOutputAsset {
  filename: string
  subfolder: string
  type: string
  kind: ComfyUIOutputType
}
