import { NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { getEngineSupabaseAdmin } from '@/lib/engine/supabaseAdmin'

export async function GET(request: Request) {
  const token = await getToken({
    req: request as any,
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-this',
  })

  if (!token?.id) {
    return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
  }

  const response = {
    checkpoints: ['sd15'],
    loras: ['none'],
    controlnet_models: ['control_v11p_sd15_openpose'],
    upscale_models: ['RealESRGAN_x4plus.pth'],
    samplers: ['dpmpp_2m'],
    schedulers: ['karras'],
  }

  const admin = getEngineSupabaseAdmin()
  const { data: uploaded, error } = await admin
    .from('models')
    .select('name, type, status')
    .eq('user_id', token.id)

  if (!error && Array.isArray(uploaded)) {
    const checkpoints = new Set(response.checkpoints)
    const loras = new Set(response.loras)

    for (const row of uploaded) {
      if (!row?.name || !row?.type) continue
      if (row.status === 'FAILED') continue
      if (row.type === 'checkpoint') checkpoints.add(row.name)
      if (row.type === 'lora') loras.add(row.name)
    }

    response.checkpoints = Array.from(checkpoints)
    response.loras = Array.from(loras)
  }

  return NextResponse.json(response)
}
