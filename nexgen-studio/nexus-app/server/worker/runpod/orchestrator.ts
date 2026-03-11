import { estimateA100Credits, finalizeCredits, reserveCredits } from './credits'

type RunpodState = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TERMINATED'

type CreateRunpodRequest = {
  jobId: string
  modelId: string
  userId: string
  modelSignedUrl: string
  comfyEndpoint: string | null
  expectedRuntimeSeconds?: number
  preReservedCredits?: number
}

type RunpodPod = {
  id: string
  status: RunpodState
}

type RunpodCompletion = {
  podId: string
  status: RunpodState
  logs: string[]
  outputPath: string | null
  runtimeSeconds?: number
  estimatedCredits?: number
  actualCredits?: number
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function runpodHeaders() {
  return {
    Authorization: `Bearer ${requireEnv('RUNPOD_API_KEY')}`,
    'Content-Type': 'application/json',
  }
}

function runpodBaseUrl() {
  return process.env.RUNPOD_API_BASE_URL || 'https://api.runpod.io/v2'
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function launchRunpodA100(request: CreateRunpodRequest): Promise<RunpodPod> {
  const image = process.env.RUNPOD_CONTAINER_IMAGE || 'ghcr.io/your-org/inference:latest'
  const gpuType = process.env.RUNPOD_GPU_TYPE || 'A100-80GB'
  const endpoint = `${runpodBaseUrl()}/instances`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: runpodHeaders(),
    body: JSON.stringify({
      name: `model-validation-${request.jobId}`,
      podSpec: {
        image,
        gpu: gpuType,
        command: ['node', '/app/server/worker/runpod/workerTask.js'],
        env: {
          JOB_ID: request.jobId,
          MODEL_ID: request.modelId,
          MODEL_SIGNED_URL: request.modelSignedUrl,
          COMFY_ENDPOINT: request.comfyEndpoint || '',
          VALIDATION_RESULT_CALLBACK: process.env.RUNPOD_RESULT_CALLBACK || '',
        },
      },
      billingType: process.env.RUNPOD_BILLING_TYPE || 'spot',
      region: process.env.RUNPOD_REGION || 'US',
      // Autoscaler sketch:
      // min_instances=0, launch on queue depth > 0, and terminate after idle timeout.
    }),
  })

  if (!response.ok) {
    throw new Error(`Runpod launch failed: ${response.status}`)
  }

  const data = (await response.json()) as { id?: string; status?: RunpodState }
  if (!data.id) {
    throw new Error('Runpod launch response missing pod id')
  }

  return {
    id: data.id,
    status: data.status || 'PENDING',
  }
}

export async function pollRunpodCompletion(podId: string): Promise<RunpodCompletion> {
  const endpoint = `${runpodBaseUrl()}/instances/${encodeURIComponent(podId)}`
  const timeoutMs = Number(process.env.RUNPOD_MAX_RUNTIME_MS || 20 * 60 * 1000)
  const intervalMs = Number(process.env.RUNPOD_POLL_INTERVAL_MS || 5000)
  const startedAt = Date.now()
  const logs: string[] = []

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(endpoint, { headers: runpodHeaders() })
    if (!response.ok) {
      throw new Error(`Runpod status check failed: ${response.status}`)
    }

    const data = (await response.json()) as {
      status?: RunpodState
      logs?: string[] | string
      output_path?: string | null
    }

    if (Array.isArray(data.logs)) {
      logs.push(...data.logs.slice(-5))
    } else if (typeof data.logs === 'string') {
      logs.push(data.logs)
    }

    const status = data.status || 'PENDING'
    if (status === 'COMPLETED' || status === 'FAILED' || status === 'TERMINATED') {
      return {
        podId,
        status,
        logs,
        outputPath: data.output_path || null,
      }
    }

    await sleep(intervalMs)
  }

  throw new Error(`Runpod timeout after ${timeoutMs}ms for pod ${podId}`)
}

export async function terminateRunpodPod(podId: string) {
  const endpoint = `${runpodBaseUrl()}/instances/${encodeURIComponent(podId)}`
  const response = await fetch(endpoint, {
    method: 'DELETE',
    headers: runpodHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Runpod terminate failed: ${response.status}`)
  }
}

export async function runModelValidationOnRunpod(input: CreateRunpodRequest): Promise<RunpodCompletion> {
  const startedAt = Date.now()
  const expectedRuntimeSeconds = Number(input.expectedRuntimeSeconds || process.env.RUNPOD_EST_RUNTIME_SECONDS || 600)
  const estimatedCredits = estimateA100Credits(expectedRuntimeSeconds)
  const reservedCredits =
    typeof input.preReservedCredits === 'number' && Number.isFinite(input.preReservedCredits)
      ? Math.max(1, Math.floor(input.preReservedCredits))
      : estimatedCredits

  if (!input.preReservedCredits) {
    try {
      await reserveCredits({
        userId: input.userId,
        jobRef: input.jobId,
        estimatedCredits,
      })
    } catch (error) {
      const blocked = new Error(
        error instanceof Error ? `GPU credit reserve failed: ${error.message}` : 'GPU credit reserve failed'
      ) as Error & { status?: number }
      blocked.status = 402
      throw blocked
    }
  }

  const pod = await launchRunpodA100(input)
  try {
    const completion = await pollRunpodCompletion(pod.id)
    const runtimeSeconds = Math.max(1, Math.ceil((Date.now() - startedAt) / 1000))
    const actualCredits = estimateA100Credits(runtimeSeconds)

    await finalizeCredits({
      userId: input.userId,
      jobRef: input.jobId,
      estimatedCredits: reservedCredits,
      actualCredits,
    })

    return {
      ...completion,
      runtimeSeconds,
      estimatedCredits: reservedCredits,
      actualCredits,
    }
  } finally {
    try {
      await terminateRunpodPod(pod.id)
    } catch (error) {
      console.error(`[runpod] failed to terminate pod ${pod.id}`, error)
    }
  }
}
