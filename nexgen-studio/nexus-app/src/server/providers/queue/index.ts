import { BullMqQueueProvider } from '@/server/providers/queue/bullmqQueueProvider'

export function getQueueProvider() {
  return new BullMqQueueProvider()
}
