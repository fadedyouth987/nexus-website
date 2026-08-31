import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute, validateBody } from '../security';
import { createUserClient, requireActiveSubscription, requireAuth, requireRole, requireWorkspace, type AuthenticatedRequest, writeAudit } from '../supabase';

const router = Router();
router.use(requireAuth, requireWorkspace, requireActiveSubscription('booking.core'));

router.get('/appointments', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const from = String(req.query.from || new Date(Date.now() - 86_400_000).toISOString());
  const to = String(req.query.to || new Date(Date.now() + 30 * 86_400_000).toISOString());
  const { data, error } = await db.from('appointments')
    .select('id,title,starts_at,ends_at,status,address_text,customer_id,customers(display_name),service_id,services(name),assigned_user_id,sync_status')
    .eq('workspace_id', req.workspaceId!).gte('starts_at', from).lte('starts_at', to).order('starts_at').limit(500);
  if (error) return res.status(500).json({ error: 'APPOINTMENT_LIST_FAILED' });
  res.json({ appointments: data ?? [] });
}));

router.post('/appointments', requireRole('owner','admin','manager','staff'), validateBody(z.object({
  customer_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid().nullable().optional(),
  assigned_user_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(200),
  address_text: z.string().trim().max(500).nullable().optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  timezone: z.string().trim().min(3).max(80).default('Australia/Adelaide'),
  notes: z.string().trim().max(4000).default(''),
})), asyncRoute(async (req: AuthenticatedRequest, res) => {
  if (new Date(req.body.ends_at) <= new Date(req.body.starts_at)) return res.status(400).json({ error: 'INVALID_TIME_RANGE' });
  const db = createUserClient(req.auth!.accessToken);
  if (req.body.assigned_user_id) {
    const { data: conflict, error: conflictError } = await db.from('appointments').select('id').eq('workspace_id', req.workspaceId!)
      .eq('assigned_user_id', req.body.assigned_user_id).in('status', ['hold','scheduled','confirmed'])
      .lt('starts_at', req.body.ends_at).gt('ends_at', req.body.starts_at).limit(1);
    if (conflictError) return res.status(500).json({ error: 'AVAILABILITY_CHECK_FAILED' });
    if (conflict?.length) return res.status(409).json({ error: 'BOOKING_CONFLICT' });
  }
  const { data, error } = await db.from('appointments').insert({ ...req.body, workspace_id: req.workspaceId!, status: 'scheduled', source: 'jobryn' }).select('*').single();
  if (error) return res.status(400).json({ error: 'APPOINTMENT_CREATE_FAILED', message: error.message });
  await writeAudit(req, 'appointment.created', 'appointment', data.id);
  res.status(201).json({ appointment: data });
}));

router.get('/jobs', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('jobs')
    .select('id,job_number,title,status,address_text,scheduled_start,scheduled_end,completed_at,customer_id,customers(display_name),service_id,services(name),assigned_user_id')
    .eq('workspace_id', req.workspaceId!).order('created_at', { ascending: false }).limit(300);
  if (error) return res.status(500).json({ error: 'JOB_LIST_FAILED' });
  res.json({ jobs: data ?? [] });
}));

router.post('/jobs', requireRole('owner','admin','manager','staff'), validateBody(z.object({
  customer_id: z.string().uuid().nullable().optional(),
  lead_id: z.string().uuid().nullable().optional(),
  appointment_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).default(''),
  address_text: z.string().trim().max(500).nullable().optional(),
  assigned_user_id: z.string().uuid().nullable().optional(),
  scheduled_start: z.string().datetime().nullable().optional(),
  scheduled_end: z.string().datetime().nullable().optional(),
})), asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('jobs').insert({ ...req.body, workspace_id: req.workspaceId! }).select('*').single();
  if (error) return res.status(400).json({ error: 'JOB_CREATE_FAILED', message: error.message });
  await writeAudit(req, 'job.created', 'job', data.id);
  res.status(201).json({ job: data });
}));

router.patch('/jobs/:id/status', requireRole('owner','admin','manager','staff'), validateBody(z.object({ status: z.enum(['new','scheduled','on_the_way','in_progress','completed','invoiced','paid','cancelled']) })), asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const patch: Record<string, unknown> = { status: req.body.status, updated_at: new Date().toISOString() };
  if (req.body.status === 'completed') patch.completed_at = new Date().toISOString();
  const { data, error } = await db.from('jobs').update(patch).eq('workspace_id', req.workspaceId!).eq('id', req.params.id).select('*').maybeSingle();
  if (error) return res.status(400).json({ error: 'JOB_UPDATE_FAILED' });
  if (!data) return res.status(404).json({ error: 'JOB_NOT_FOUND' });
  await writeAudit(req, 'job.status.changed', 'job', data.id, { status: req.body.status });
  res.json({ job: data });
}));

router.get('/quotes', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('quotes').select('id,quote_number,status,total_cents,expires_at,created_at,customer_id,customers(display_name),job_id').eq('workspace_id', req.workspaceId!).order('created_at', { ascending: false }).limit(300);
  if (error) return res.status(500).json({ error: 'QUOTE_LIST_FAILED' });
  res.json({ quotes: data ?? [] });
}));

router.get('/invoices', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('invoices').select('id,invoice_number,status,total_cents,amount_paid_cents,balance_due_cents,due_at,created_at,customer_id,customers(display_name),job_id').eq('workspace_id', req.workspaceId!).order('created_at', { ascending: false }).limit(300);
  if (error) return res.status(500).json({ error: 'INVOICE_LIST_FAILED' });
  res.json({ invoices: data ?? [] });
}));

router.get('/payments', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('payments').select('id,amount_cents,currency,status,paid_at,created_at,customer_id,customers(display_name),invoice_id').eq('workspace_id', req.workspaceId!).order('created_at', { ascending: false }).limit(300);
  if (error) return res.status(500).json({ error: 'PAYMENT_LIST_FAILED' });
  res.json({ payments: data ?? [] });
}));

export default router;
