import { getBlueprintRedis } from './redis'
import { toBullMqQueueName } from '@/server/providers/queue/queueName'

function loadQueue() {
  const req = eval('require') as NodeRequire
  return req('bullmq').Queue
}

export function queueName(policy: 'SFW' | 'NSFW', type: 'IMAGE' | 'VIDEO') {
  if (policy === 'SFW' && type === 'IMAGE') return 'generation:safe:image'
  if (policy === 'SFW' && type === 'VIDEO') return 'generation:safe:video'
  if (policy === 'NSFW' && type === 'IMAGE') return 'generation:vault:image'
  return 'generation:vault:video'
}

export async function enqueueBlueprintGeneration(jobId: string, queue: string) {
  const connection = getBlueprintRedis()
  const Queue = loadQueue()
  const q = new Queue(toBullMqQueueName(queue), { connection })
  try {
    await q.add(
      'generate',
      { jobId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      }
    )
  } finally {
    await q.close()
    await connection.quit()
  }
}
