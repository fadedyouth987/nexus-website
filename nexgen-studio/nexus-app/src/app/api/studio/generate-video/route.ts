import { queueStudioJob } from '@/app/api/studio/generate/route'

export async function POST(request: Request) {
  return queueStudioJob(request, 'video')
}
