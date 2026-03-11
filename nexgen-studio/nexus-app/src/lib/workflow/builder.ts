import type { ComfyUIWorkflow, ComfyUINode } from '@/lib/comfyui/types'
import { getModelSet, type FullModelSet } from '@/lib/comfyui/models'
import type { BuildWorkflowOptions, VariableMap } from './types'
import { resolveWorkflow } from './resolver'

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

function replaceInString(template: string, variables: VariableMap): string | number {
  const match = template.match(/^\{\{(\w+)\}\}$/)
  if (match) {
    const key = match[1]!
    const value = variables[key]
    if (value === undefined) {
      return template
    }

    if (
      NUMERIC_KEYS.has(key) &&
      (typeof value === 'number' || (typeof value === 'string' && /^-?\d+$/.test(value)))
    ) {
      return typeof value === 'number' ? value : parseInt(value, 10)
    }

    return String(value)
  }

  return template.replace(PLACEHOLDER_REGEX, (_, key) => {
    const value = variables[key]
    if (value === undefined) {
      return `{{${key}}}`
    }

    return String(value)
  })
}

function replaceInValue(value: unknown, variables: VariableMap): unknown {
  if (typeof value === 'string') {
    return replaceInString(value, variables)
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceInValue(item, variables))
  }

  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, nestedValue] of Object.entries(value)) {
      out[key] = replaceInValue(nestedValue, variables)
    }
    return out
  }

  return value
}

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
    if ('ckpt_name' in inputs) {
      inputs.ckpt_name = modelSet.checkpoint
    }
    if ('ckpt_name_1' in inputs) {
      inputs.ckpt_name_1 = modelSet.checkpoint
    }
  }

  if (modelSet.vae && (inputs.vae_name !== undefined || inputs.vae_name_1 !== undefined)) {
    if ('vae_name' in inputs) {
      inputs.vae_name = modelSet.vae
    }
    if ('vae_name_1' in inputs) {
      inputs.vae_name_1 = modelSet.vae
    }
  }

  if (modelSet.controlnet?.[0] && inputs.control_net_name !== undefined) {
    inputs.control_net_name = modelSet.controlnet[0]
  }

  if (modelSet.motion_module && inputs.model_name !== undefined) {
    inputs.model_name = modelSet.motion_module
  }

  return { ...node, inputs }
}

export function buildWorkflow(
  template: ComfyUIWorkflow,
  options: BuildWorkflowOptions = {}
): ComfyUIWorkflow {
  const {
    variables = {},
    variableBindings = null,
    finalInputs = {},
    modelName,
    modelOverrides = {},
  } = options

  const resolvedTemplate = variableBindings
    ? (resolveWorkflow(template as Record<string, any>, variableBindings, finalInputs) as ComfyUIWorkflow)
    : template

  const withVars = replaceInValue(resolvedTemplate, variables) as ComfyUIWorkflow
  const modelSet: Partial<FullModelSet> = modelName ? getModelSet(modelName) : {}
  const effectiveCheckpoint = modelOverrides.checkpoint ?? modelSet.checkpoint
  const effectiveVae = modelOverrides.vae ?? modelSet.vae
  const effectiveControlnet = modelOverrides.controlnet ? [modelOverrides.controlnet] : modelSet.controlnet

  if (!effectiveCheckpoint && !effectiveVae && !effectiveControlnet?.length) {
    return withVars
  }

  const effectiveMotion = modelOverrides.motion_module ?? modelSet.motion_module
  const effectiveSet = {
    checkpoint: effectiveCheckpoint,
    vae: effectiveVae,
    controlnet: effectiveControlnet,
    loras: modelSet.loras,
    motion_module: effectiveMotion,
  }

  const result: ComfyUIWorkflow = {}
  for (const [nodeId, node] of Object.entries(withVars)) {
    result[nodeId] = injectModelPathsIntoNode(node, effectiveSet)
  }

  return result
}

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
