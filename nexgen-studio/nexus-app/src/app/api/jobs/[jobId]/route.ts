import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import {
  getActiveOrgIdsForUser,
  getGenerationJobById,
  getGenerationAssetsByJobId,
} from '@/lib/automation/jobStatus'

export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const jobId = params.jobId

    const orgIds = await getActiveOrgIdsForUser(userId)
    if (orgIds.length === 0) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const job = await getGenerationJobById(jobId, userId, { orgIds })
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const assets = await getGenerationAssetsByJobId(jobId, userId, { orgIds })

    return NextResponse.json({
      job,
      assets,
    })
  } catch (error) {
    console.error('[api/jobs/[job_id]] error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}