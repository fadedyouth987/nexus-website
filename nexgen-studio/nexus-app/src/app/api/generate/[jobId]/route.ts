import { NextResponse } from 'next/server'
import { requireBlueprintUser } from '@/lib/blueprint/auth'
import { getBlueprintSupabaseAdmin } from '@/lib/blueprint/supabaseAdmin'

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { authUserId } = await requireBlueprintUser(request)
    const { jobId } = await context.params
    const admin = getBlueprintSupabaseAdmin()

    const { data: job, error } = await admin
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', authUserId)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ detail: 'Failed to load job' }, { status: 500 })
    }

    if (!job) {
      return NextResponse.json({ detail: 'Job not found' }, { status: 404 })
    }

    const { data: assets, error: assetError } = await admin
      .from('generated_assets')
      .select('*')
      .eq('generation_job_id', job.id)
      .order('created_at', { ascending: true })

    if (assetError) {
      return NextResponse.json({ detail: 'Failed to load job assets' }, { status: 500 })
    }

    return NextResponse.json({ job, assets: assets ?? [] })
  } catch (error) {
    const status = typeof (error as { status?: number }).status === 'number'
      ? (error as { status: number }).status
      : 500
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load job' },
      { status }
    )
  }
}
