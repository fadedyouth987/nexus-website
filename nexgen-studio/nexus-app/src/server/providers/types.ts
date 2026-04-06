export type QueueJobPayload = {
  type: string
  id: string
  metadata?: Record<string, unknown>
}

export interface QueueProvider {
  enqueue(queueName: string, payload: QueueJobPayload): Promise<void>
}

export interface StorageProvider {
  upload(params: {
    key: string
    body: Buffer
    contentType: string
  }): Promise<{ key: string; url?: string | null }>
}

export interface LlmProvider {
  complete(prompt: string, options?: { model?: string; temperature?: number }): Promise<string>
}

export interface MediaGenerationProvider {
  submitJob(input: Record<string, unknown>): Promise<{ providerJobId: string }>
  getJob(providerJobId: string): Promise<{ status: string; output?: Record<string, unknown> | null }>
}

export interface VoiceProvider {
  synthesize(input: {
    script: string
    voice: string
  }): Promise<{ assetUrl: string }>
}
