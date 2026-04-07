import { requireAppSession, requireAdminRole } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import { ApprovalsClient } from '@/components/admin/ApprovalsClient'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Approval Queue',
  description: 'Review and approve pending generation jobs',
}

export default async function ApprovalsPage() {
  const session = await requireAppSession()
  await requireAdminRole(session)

  const admin = getSupabaseAdmin()

  const { data: pendingJobs } = await admin
    .from('generation_jobs')
    .select('*, influencers(name, avatar_url)')
    .eq('status', 'PENDING_APPROVAL')
    .eq('organization_id', session.orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <ApprovalsClient
      initialJobs={pendingJobs || []}
      orgId={session.orgId}
    />
  )
}
