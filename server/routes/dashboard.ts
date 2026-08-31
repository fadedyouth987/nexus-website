import { Router } from 'express';
import { asyncRoute } from '../security';
import { createUserClient, requireActiveSubscription, requireAuth, requireWorkspace, type AuthenticatedRequest } from '../supabase';

const router = Router();
router.use(requireAuth, requireWorkspace, requireActiveSubscription('crm.core'));

router.get('/', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const workspaceId = req.workspaceId!;
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const startToday = new Date(now); startToday.setHours(0,0,0,0);
  const endToday = new Date(startToday); endToday.setDate(endToday.getDate() + 1);

  const [
    leads,
    customers,
    todaysJobs,
    openQuotes,
    outstandingInvoices,
    revenue,
    aiActions,
  ] = await Promise.all([
    db.from('leads').select('id,stage', { count: 'exact' }).eq('workspace_id', workspaceId).is('deleted_at', null),
    db.from('customers').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).is('deleted_at', null),
    db.from('jobs').select('id,title,status,scheduled_start,customer_id,customers(display_name)').eq('workspace_id', workspaceId).gte('scheduled_start', startToday.toISOString()).lt('scheduled_start', endToday.toISOString()).order('scheduled_start').limit(12),
    db.from('quotes').select('id,total_cents,status', { count: 'exact' }).eq('workspace_id', workspaceId).in('status', ['sent','viewed','awaiting_approval']),
    db.from('invoices').select('id,balance_due_cents,status').eq('workspace_id', workspaceId).in('status', ['sent','viewed','part_paid','overdue']),
    db.from('payments').select('amount_cents').eq('workspace_id', workspaceId).eq('status', 'succeeded').gte('paid_at', startOfMonth),
    db.from('ai_actions').select('id,status', { count: 'exact' }).eq('workspace_id', workspaceId).gte('created_at', startOfMonth),
  ]);

  const fail = [leads.error,customers.error,todaysJobs.error,openQuotes.error,outstandingInvoices.error,revenue.error,aiActions.error].find(Boolean);
  if (fail) return res.status(500).json({ error: 'DASHBOARD_READ_FAILED' });

  const leadRows = leads.data ?? [];
  const newLeads = leadRows.filter((l: any) => l.stage === 'new').length;
  const bookedLeads = leadRows.filter((l: any) => ['booked','won','completed'].includes(l.stage)).length;
  const outstandingCents = (outstandingInvoices.data ?? []).reduce((sum: number, row: any) => sum + Number(row.balance_due_cents || 0), 0);
  const monthRevenueCents = (revenue.data ?? []).reduce((sum: number, row: any) => sum + Number(row.amount_cents || 0), 0);

  res.json({
    metrics: {
      customers: customers.count ?? 0,
      leads: leadRows.length,
      newLeads,
      bookedLeads,
      openQuotes: openQuotes.count ?? 0,
      outstandingCents,
      monthRevenueCents,
      aiActions: aiActions.count ?? 0,
    },
    today: todaysJobs.data ?? [],
  });
}));

export default router;
