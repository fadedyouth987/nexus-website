export const SAFE_IMAGE_WORKFLOW_PRESET = 'safe-image-v1'

function boundedInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

function boundedFloat(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(max, Math.max(min, parsed))
}

export function buildSafeImageWorkflow(input: { prompt: string; seed: number }) {
  const checkpoint = process.env.COMFYUI_SAFE_IMAGE_CHECKPOINT || 'sd15.safetensors'
  const negativePrompt =
    process.env.COMFYUI_SAFE_IMAGE_NEGATIVE_PROMPT ||
    'lowres, blurry, bad anatomy, disfigured, watermark, text'
  const width = boundedInt(process.env.COMFYUI_SAFE_IMAGE_WIDTH, 1024, 256, 2048)
  const height = boundedInt(process.env.COMFYUI_SAFE_IMAGE_HEIGHT, 1024, 256, 2048)
  const steps = boundedInt(process.env.COMFYUI_SAFE_IMAGE_STEPS, 24, 1, 80)
  const cfg = boundedFloat(process.env.COMFYUI_SAFE_IMAGE_CFG, 7, 1, 20)

  return {
    '3': {
      inputs: {
        seed: input.seed,
        steps,
        cfg,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
      class_type: 'KSampler',
    },
    '4': {
      inputs: {
        ckpt_name: checkpoint,
      },
      class_type: 'CheckpointLoaderSimple',
    },
    '5': {
      inputs: {
        width,
        height,
        batch_size: 1,
      },
      class_type: 'EmptyLatentImage',
    },
    '6': {
      inputs: {
        text: input.prompt,
        clip: ['4', 1],
      },
      class_type: 'CLIPTextEncode',
    },
    '7': {
      inputs: {
        text: negativePrompt,
        clip: ['4', 1],
      },
      class_type: 'CLIPTextEncode',
    },
    '8': {
      inputs: {
        samples: ['3', 0],
        vae: ['4', 2],
      },
      class_type: 'VAEDecode',
    },
    '9': {
      inputs: {
        filename_prefix: 'v2_safe_image',
        images: ['8', 0],
      },
      class_type: 'SaveImage',
    },
  }
}
