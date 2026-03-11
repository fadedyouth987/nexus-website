/**
 * Workflow template variable injection and model path injection.
 * Replaces {{placeholder}} in workflow JSON and injects model paths from the registry.
 */

import type { ComfyUIWorkflow, ComfyUINode } from '@/lib/comfyui/types'
import { getModelSet, type KnownModelId, type FullModelSet } from '@/lib/comfyui/models'

export type VariableMap = Record<string, string | number | boolean>

const PLACEHOLDER_REGEX = /\{\{(\w+)\}\}/g

const NUMERIC_KEYS = new Set([
  'seed',
  'steps',
  'cfg',
  'denoise',
  'width',
  'height',
  'batch_size',
  'frame_rate',
  'duration',
  'num_frames',
  'fps',
  'motion_strength',
])

/**
 * Replace {{key}} placeholders in a string with values from the map.
 * Coerce numeric keys to numbers when the value is numeric.
 */
function replaceInString(template: string, variables: VariableMap): string | number {
  const match = template.match(/^\{\{(\w+)\}\}$/)
  if (match) {
    const key = match[1]!
    const value = variables[key]
    if (value === undefined) return template
    if (NUMERIC_KEYS.has(key) && (typeof value === 'number' || (typeof value === 'string' && /^-?\d+$/.test(value)))) {
      return typeof value === 'number' ? value : parseInt(value, 10)
    }
    return String(value)
  }
  return template.replace(PLACEHOLDER_REGEX, (_, key) => {
    const value = variables[key]
    if (value === undefined) return `{{${key}}}`
    return String(value)
  })
}

/**
 * Recursively replace {{key}} in any JSON-serializable value.
 */
function replaceInValue(value: unknown, variables: VariableMap): unknown {
  if (typeof value === 'string') {
    const out = replaceInString(value, variables)
    return out
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceInValue(item, variables))
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = replaceInValue(v, variables)
    }
    return out
  }
  return value
}

/**
 * Inject model paths into a node's inputs using a model set.
 * Common input keys: ckpt_name, vae_name, control_net_name, lora_name.
 */
function injectModelPathsIntoNode(
  node: ComfyUINode,
  modelSet: {
    checkpoint?: string
    vae?: string
    controlnet?: string[]
    loras?: Array<{ path: string }>
    motion_module?: string
  }
): ComfyUINode {
  const inputs = { ...node.inputs }
  if (modelSet.checkpoint && (inputs.ckpt_name !== undefined || inputs.ckpt_name_1 !== undefined)) {
    if ('ckpt_name' in inputs) inputs.ckpt_name = modelSet.checkpoint
    if ('ckpt_name_1' in inputs) inputs.ckpt_name_1 = modelSet.checkpoint
  }
  if (modelSet.vae && (inputs.vae_name !== undefined || inputs.vae_name_1 !== undefined)) {
    if ('vae_name' in inputs) inputs.vae_name = modelSet.vae
    if ('vae_name_1' in inputs) inputs.vae_name_1 = modelSet.vae
  }
  if (modelSet.controlnet?.[0] && inputs.control_net_name !== undefined) {
    inputs.control_net_name = modelSet.controlnet[0]
  }
  if (modelSet.motion_module && inputs.model_name !== undefined) {
    inputs.model_name = modelSet.motion_module
  }
  return { ...node, inputs }
}

/**
 * Build final workflow: clone template, replace {{variables}}, inject model paths.
 */
export function buildWorkflow(
  template: ComfyUIWorkflow,
  options: {
    variables: VariableMap
    modelName?: KnownModelId
    /** Override model paths per key (e.g. checkpoint path from template config) */
    modelOverrides?: Record<string, string>
  }
): ComfyUIWorkflow {
  const { variables, modelName, modelOverrides = {} } = options

  // 1. Replace all {{var}} placeholders in a deep clone
  const withVars = replaceInValue(template, variables) as ComfyUIWorkflow

  // 2. Model set from registry (or overrides only)
  const modelSet: Partial<FullModelSet> = modelName ? getModelSet(modelName) : {}
  const effectiveCheckpoint = modelOverrides.checkpoint ?? modelSet.checkpoint
  const effectiveVae = modelOverrides.vae ?? modelSet.vae
  const effectiveControlnet = modelOverrides.controlnet
    ? [modelOverrides.controlnet]
    : modelSet.controlnet

  if (!effectiveCheckpoint && !effectiveVae && !effectiveControlnet?.length) {
    return withVars
  }

  const effectiveMotion =
    modelOverrides.motion_module ?? modelSet.motion_module
  const effectiveSet = {
    checkpoint: effectiveCheckpoint,
    vae: effectiveVae,
    controlnet: effectiveControlnet,
    loras: modelSet.loras,
    motion_module: effectiveMotion,
  }

  // 3. Inject model paths into each node
  const result: ComfyUIWorkflow = {}
  for (const [nodeId, node] of Object.entries(withVars)) {
    result[nodeId] = injectModelPathsIntoNode(node, effectiveSet)
  }
  return result
}

/**
 * Default variables when not provided (e.g. random seed).
 */
export function defaultVariables(extra: VariableMap = {}): VariableMap {
  return {
    seed: Math.floor(Math.random() * 2 ** 32),
    prompt: '',
    negative_prompt: '',
    steps: 20,
    cfg: 7.5,
    denoise: 1,
    lora_strength: 0.8,
    width: 1024,
    height: 1024,
    sampler_name: 'euler',
    scheduler: 'normal',
    batch_size: 16,
    frame_rate: 8,
    duration: 5,
    aspect_ratio: '16:9',
    motion_strength: 1.0,
    num_frames: 16,
    fps: 24,
    ...extra,
  }
}
