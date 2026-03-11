function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function loadRedis() {
  const req = eval('require') as NodeRequire
  return req('ioredis')
}

export function getWorkerRedis() {
  const IORedis = loadRedis()
  return new IORedis(requireEnv('REDIS_URL'), { maxRetriesPerRequest: null })
}

export async function publishJobEvent(jobId: string, payload: Record<string, unknown>) {
  const redis = getWorkerRedis()
  try {
    await redis.publish(`generation:${jobId}`, JSON.stringify(payload))
  } finally {
    await redis.quit()
  }
}
