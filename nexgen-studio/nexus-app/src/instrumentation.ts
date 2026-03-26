export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { parseCoreEnv } = await import('@/lib/core/env')
    parseCoreEnv()
  }
}
