import { requireEnv } from './env'

function loadRedis() {
  const req = eval('require') as NodeRequire
  return req('ioredis')
}

export function getBlueprintRedis() {
  const IORedis = loadRedis()
  return new IORedis(requireEnv('REDIS_URL'), { maxRetriesPerRequest: null })
}

export function getBlueprintRedisSubscriber() {
  const IORedis = loadRedis()
  return new IORedis(requireEnv('REDIS_URL'), { maxRetriesPerRequest: null })
}
