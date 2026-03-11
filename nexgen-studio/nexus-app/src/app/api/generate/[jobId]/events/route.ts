import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { getBlueprintRedisSubscriber } from '@/lib/blueprint/redis'
import { getBlueprintSupabaseAdmin } from '@/lib/blueprint/supabaseAdmin'

function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    const { jobId } = await context.params
    const admin = getBlueprintSupabaseAdmin()

    const { data: job } = await admin
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', authUserId)
      .maybeSingle()

    if (!job) {
      return new Response('Job not found', { status: 404 })
    }

    const channel = `generation:${job.id}`
    const subscriber = getBlueprintRedisSubscriber()

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        const send = (event: string, payload: unknown) => {
          controller.enqueue(encoder.encode(`event: ${event}\n`))
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        }

        send('snapshot', { job })
        const heartbeat = setInterval(() => send('ping', { t: Date.now() }), 25000)

        subscriber.subscribe(channel).catch(() => {
          send('error', { message: 'subscribe_failed' })
        })

        subscriber.on('message', (_ch: string, message: string) => {
          try {
            const payload = JSON.parse(message)
            send(payload?.type || 'progress', payload)
          } catch {
            send('progress', { raw: message })
          }
        })

        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeat)
          subscriber.unsubscribe(channel).finally(() => {
            subscriber.quit()
            controller.close()
          })
        })
      },
    })

    return new Response(stream, { headers: sseHeaders() })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500
    return new Response(error instanceof Error ? error.message : 'Failed to stream events', {
      status,
    })
  }
}
