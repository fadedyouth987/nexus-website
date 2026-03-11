import type { ComfyUIWorkflow } from '@/lib/comfyui/types'
import type { KnownModelId } from '@/lib/comfyui/models'

export type VariableMap = Record<string, string | number | boolean>

export type WorkflowVariableBindings = {
  fields?: Record<string, { node: string; path: string }>
} | null

export type BuildWorkflowOptions = {
  variables?: VariableMap
  variableBindings?: WorkflowVariableBindings
  finalInputs?: Record<string, unknown>
  modelName?: KnownModelId
  modelOverrides?: Record<string, string>
}

export type WorkflowTemplate = ComfyUIWorkflow
