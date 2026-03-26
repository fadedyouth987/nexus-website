/**
 * ComfyUI **HTTP API** graph (not the UI "nodes/links" JSON). Each key is a node id string.
 * See https://github.com/comfyanonymous/ComfyUI — `/prompt` expects this shape.
 */
const DEFAULT_CKPT = process.env.COMFYUI_CHECKPOINT || 'v1-5-pruned-emaonly.safetensors'

const MODEL_CKPT: Record<string, string> = {
  sd15: process.env.COMFYUI_CKPT_SD15 || DEFAULT_CKPT,
  sd21: process.env.COMFYUI_CKPT_SD21 || DEFAULT_CKPT,
  sdxl: process.env.COMFYUI_CKPT_SDXL || DEFAULT_CKPT,
  pony: process.env.COMFYUI_CKPT_PONY || DEFAULT_CKPT,
  realistic: process.env.COMFYUI_CKPT_REALISTIC || DEFAULT_CKPT,
}

function resolveCheckpoint(modelKey: string): string {
  return MODEL_CKPT[modelKey] || DEFAULT_CKPT
}

export type LoraWire = {
  path: string
  strength: number
}

/** Mirrors fields stored on `generation_jobs.input_params` from the studio UI. */
export type Txt2ImgInput = {
  positive: string
  negative: string
  width: number
  height: number
  steps: number
  cfg: number
  seed: number
  sampler_name: string
  scheduler: string
  denoise: number
  model: string
  batch_size: number
  loras: LoraWire[]
  /** 1 = default; >1 applies CLIPSetLastLayer before encodes. */
  clip_skip: number
}

export type WorkflowNodeMap = Record<string, { class_type: string; inputs: Record<string, unknown> }>

/**
 * Build a txt2img graph: checkpoint → optional CLIP skip → optional LoRA chain → encodes → KSampler → VAE → Save.
 */
export function buildTxt2ImgWorkflow(input: Txt2ImgInput): WorkflowNodeMap {
  const ckpt_name = resolveCheckpoint(input.model)
  const seed =
    input.seed >= 0 ? input.seed : Math.floor(Math.random() * 2_147_483_647)
  const batch = Math.max(1, Math.min(16, Math.floor(input.batch_size || 1)))
  const scheduler = input.scheduler || 'normal'
  const denoise = typeof input.denoise === 'number' && Number.isFinite(input.denoise) ? input.denoise : 1

  let id = 1
  const next = () => String(id++)

  const workflow: WorkflowNodeMap = {}

  const checkpointId = next()
  workflow[checkpointId] = {
    class_type: 'CheckpointLoaderSimple',
    inputs: { ckpt_name },
  }

  let modelLink: [string, number] = [checkpointId, 0]
  let clipLink: [string, number] = [checkpointId, 1]
  const vaeLink: [string, number] = [checkpointId, 2]

  const clipSkip = Math.max(1, Math.min(12, Math.floor(input.clip_skip || 1)))
  const skipClipLayer = process.env.COMFYUI_DISABLE_CLIP_SKIP === '1'
  if (!skipClipLayer && clipSkip > 1) {
    const clipLayerId = next()
    workflow[clipLayerId] = {
      class_type: 'CLIPSetLastLayer',
      inputs: {
        clip: clipLink,
        stop_at_clip_layer: -(clipSkip - 1),
      },
    }
    clipLink = [clipLayerId, 0]
  }

  const enabledLoras = (input.loras ?? []).filter((l) => l.path && typeof l.strength === 'number')
  for (const lora of enabledLoras) {
    const loraId = next()
    const loraName = lora.path.includes('/') ? lora.path.split('/').pop() || lora.path : lora.path
    const s = Math.max(0, Math.min(2, lora.strength))
    workflow[loraId] = {
      class_type: 'LoraLoader',
      inputs: {
        model: modelLink,
        clip: clipLink,
        lora_name: loraName,
        strength_model: s,
        strength_clip: s,
      },
    }
    modelLink = [loraId, 0]
    clipLink = [loraId, 1]
  }

  const positiveId = next()
  workflow[positiveId] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: input.positive, clip: clipLink },
  }

  const negativeId = next()
  workflow[negativeId] = {
    class_type: 'CLIPTextEncode',
    inputs: { text: input.negative, clip: clipLink },
  }

  const emptyId = next()
  workflow[emptyId] = {
    class_type: 'EmptyLatentImage',
    inputs: { width: input.width, height: input.height, batch_size: batch },
  }

  const ksamplerId = next()
  workflow[ksamplerId] = {
    class_type: 'KSampler',
    inputs: {
      seed,
      steps: input.steps,
      cfg: input.cfg,
      sampler_name: input.sampler_name || 'euler',
      scheduler,
      denoise,
      model: modelLink,
      positive: [positiveId, 0],
      negative: [negativeId, 0],
      latent_image: [emptyId, 0],
    },
  }

  const decodeId = next()
  workflow[decodeId] = {
    class_type: 'VAEDecode',
    inputs: { samples: [ksamplerId, 0], vae: vaeLink },
  }

  const saveId = next()
  workflow[saveId] = {
    class_type: 'SaveImage',
    inputs: { filename_prefix: 'NexusStudio', images: [decodeId, 0] },
  }

  return workflow
}
