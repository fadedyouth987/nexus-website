import { requireAppSession, requireAdminRole } from '@/server/auth/session'
import { getSupabaseAdmin } from '@/server/supabase/admin'
import { WebhookManagerClient } from '@/components/admin/WebhookManagerClient'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Webhook Management',
  description: 'Configure and manage webhooks for real-time event notifications',
}

export default async function WebhookManagementPage() {
  const session = await requireAppSession()
  await requireAdminRole(session)

  const admin = getSupabaseAdmin()

  const { data: webhooks } = await admin
    .from('organization_webhooks')
    .select('id, url, events, is_active, created_at, updated_at, secret_key')
    .eq('organization_id', session.orgId)
    .order('created_at', { ascending: false })

  // Mask secret keys
  const maskedWebhooks = webhooks?.map((wh) => ({
    ...wh,
    secret_key: wh.secret_key ? '****' + wh.secret_key.slice(-4) : null,
  })) || []

  return (
    <WebhookManagerClient
      initialWebhooks={maskedWebhooks}
      orgId={session.orgId}
    />
  )
}
