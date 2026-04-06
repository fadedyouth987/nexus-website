const fs = require('node:fs/promises')
const path = require('node:path')
const { createClient } = require('@supabase/supabase-js')

async function downloadModel(url, destination) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download model: ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  await fs.writeFile(destination, buffer)
  return buffer.length
}

async function uploadValidationArtifact(result) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) return null

  const client = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const bucket = process.env.MODEL_VALIDATION_BUCKET || 'models-validation'
  const artifactPath = `validation/${result.modelId}/${result.jobId}.json`
  const payload = Buffer.from(JSON.stringify(result, null, 2), 'utf8')

  const { error } = await client.storage.from(bucket).upload(artifactPath, payload, {
    upsert: true,
    contentType: 'application/json',
  })
  if (error) {
    throw new Error(`Failed to upload validation artifact: ${error.message}`)
  }

  return { bucket, path: artifactPath }
}

async function postCallback(result) {
  const callbackUrl = process.env.VALIDATION_RESULT_CALLBACK
  if (!callbackUrl) return
  await fetch(callbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  })
}

async function main() {
  const jobId = process.env.JOB_ID
  const modelId = process.env.MODEL_ID
  const modelSignedUrl = process.env.MODEL_SIGNED_URL
  const comfyEndpoint = process.env.COMFY_ENDPOINT || ''

  if (!jobId || !modelId || !modelSignedUrl) {
    throw new Error('Missing JOB_ID, MODEL_ID, or MODEL_SIGNED_URL')
  }

  const outputDir = process.env.MODEL_TASK_DIR || '/tmp'
  await fs.mkdir(outputDir, { recursive: true })
  const modelPath = path.join(outputDir, `${modelId}.bin`)
  const bytes = await downloadModel(modelSignedUrl, modelPath)

  // Placeholder validation/inference step. Replace with actual container logic:
  // 1) load model into ComfyUI or native runtime
  // 2) call comfyClient.validateModel(...) or equivalent test workflow
  // 3) run a short deterministic inference
  // 4) collect runtime + quality metrics
  const result = {
    jobId,
    modelId,
    comfyEndpoint,
    status: 'COMPLETED',
    metrics: {
      downloaded_bytes: bytes,
      warmup_seconds: 3,
      inference_seconds: 8,
      gpu_seconds: 11,
    },
    createdAt: new Date().toISOString(),
  }

  const artifact = await uploadValidationArtifact(result)
  await postCallback({ ...result, artifact })
  console.log(JSON.stringify({ ok: true, artifact }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
