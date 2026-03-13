export function toBullMqQueueName(queueName: string) {
  return queueName.replaceAll(':', '__')
}
