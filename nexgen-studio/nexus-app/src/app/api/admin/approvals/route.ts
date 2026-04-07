import { NextResponse } from 'next/server'
import { requireAppSession, requireAdminRole } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import { approveGenerationJob, rejectGenerationJob } from '@/lib/blueprint/createJob'

export const dynamic = 'force-dynamic'

/**
 * GET /api/admin/approvals - List jobs pending approval
 */
export async function GET() {
  const session = await requireAppSession()
  await requireAdminRole(session)

  try {
    const admin = getSupabaseAdmin()

    const { data: pendingJobs, error } = await admin
      .from('generation_jobs')
      .select('*, influencers(name)')
      .eq('status', 'PENDING_APPROVAL')
      .eq('organization_id', session.orgId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ detail: error.message }, { status: 500 })
    }

    return NextResponse.json({
      jobs: pendingJobs || [],
      count: pendingJobs?.length || 0,
    })
  } catch (error) {
    console.error('Failed to fetch pending approvals:', error)
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Failed to load approvals' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/approvals - Approve or reject a job
 */
export async function POST(request: Request) {
  const session = await requireAppSession()
  await requireAdminRole(session)

  try {
    const body = await request.json()
    const { jobId, action, reason } = body

    if (!jobId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { detail: 'jobId and action (approve|reject) required' },
        { status: 400 }
      )
    }

    const result =
      action === 'approve'
        ? await approveGenerationJob(jobId, session.userId)
        : await rejectGenerationJob(jobId, session.userId, reason)

    if (!result.success) {
      return NextResponse.json({ detail: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      jobId,
      action,
    })
  } catch (error) {
    console.error('Approval action failed:', error)
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Approval action failed' },
      { status: 500 }
    )
  }
}
