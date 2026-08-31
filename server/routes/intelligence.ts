import { Router } from 'express';
import { z } from 'zod';
import { asyncRoute, validateBody } from '../security';
import { createUserClient, requireActiveSubscription, requireAuth, requireRole, requireWorkspace, type AuthenticatedRequest, writeAudit } from '../supabase';

const router = Router();
router.use(requireAuth, requireWorkspace, requireActiveSubscription('ai.basic'));

router.get('/conversations', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('conversations')
    .select('id,subject,status,handling_mode,last_message_at,assigned_user_id,customer_id,customers(display_name,phone,email),lead_id')
    .eq('workspace_id', req.workspaceId!).order('last_message_at', { ascending: false, nullsFirst: false }).limit(200);
  if (error) return res.status(500).json({ error: 'CONVERSATION_LIST_FAILED' });
  res.json({ conversations: data ?? [] });
}));

router.get('/conversations/:id/messages', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('messages')
    .select('id,channel,direction,purpose,sender_type,body,status,sent_at,delivered_at,read_at,created_at')
    .eq('workspace_id', req.workspaceId!).eq('conversation_id', req.params.id).order('created_at').limit(500);
  if (error) return res.status(500).json({ error: 'MESSAGE_LIST_FAILED' });
  res.json({ messages: data ?? [] });
}));

router.get('/knowledge', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('knowledge_documents').select('id,title,source_type,source_url,approved,created_at,updated_at').eq('workspace_id', req.workspaceId!).order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'KNOWLEDGE_LIST_FAILED' });
  res.json({ documents: data ?? [] });
}));

router.post('/knowledge', requireRole('owner','admin','manager'), validateBody(z.object({
  title: z.string().trim().min(2).max(200),
  source_type: z.enum(['manual','faq','policy','website','file','service','pricing']),
  source_url: z.string().url().max(1000).nullable().optional(),
  content: z.string().trim().min(1).max(100_000),
  approved: z.boolean().default(false),
})), asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('knowledge_documents').insert({ ...req.body, workspace_id: req.workspaceId!, created_by: req.auth!.userId }).select('id,title,source_type,approved,created_at').single();
  if (error) return res.status(400).json({ error: 'KNOWLEDGE_CREATE_FAILED', message: error.message });
  await writeAudit(req, 'knowledge.created', 'knowledge_document', data.id, { approved: data.approved });
  res.status(201).json({ document: data });
}));

router.get('/approvals', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('approvals').select('id,resource_type,resource_id,reason,status,requested_by,decided_by,decision_note,created_at,decided_at,ai_action_id').eq('workspace_id', req.workspaceId!).order('created_at', { ascending: false }).limit(200);
  if (error) return res.status(500).json({ error: 'APPROVAL_LIST_FAILED' });
  res.json({ approvals: data ?? [] });
}));

router.post('/approvals/:id/decision', requireRole('owner','admin','manager'), validateBody(z.object({ decision: z.enum(['approved','rejected']), note: z.string().trim().max(2000).default('') })), asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('approvals').update({ status: req.body.decision, decision_note: req.body.note, decided_by: req.auth!.userId, decided_at: new Date().toISOString() }).eq('workspace_id', req.workspaceId!).eq('id', req.params.id).eq('status','pending').select('*').maybeSingle();
  if (error) return res.status(400).json({ error: 'APPROVAL_DECISION_FAILED' });
  if (!data) return res.status(409).json({ error: 'APPROVAL_ALREADY_DECIDED_OR_MISSING' });
  await writeAudit(req, `approval.${req.body.decision}`, 'approval', data.id);
  res.json({ approval: data });
}));

router.get('/ai-actions', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('ai_actions').select('id,tool_name,risk_level,status,approval_required,error_code,cost_microunits,created_at,completed_at,customer_id,conversation_id').eq('workspace_id', req.workspaceId!).order('created_at',{ascending:false}).limit(300);
  if (error) return res.status(500).json({ error: 'AI_ACTION_LIST_FAILED' });
  res.json({ actions: data ?? [] });
}));

router.get('/automations', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('automations').select('id,name,description,status,trigger_key,version,created_at,updated_at').eq('workspace_id', req.workspaceId!).order('updated_at',{ascending:false});
  if (error) return res.status(500).json({ error: 'AUTOMATION_LIST_FAILED' });
  res.json({ automations: data ?? [] });
}));

router.get('/reviews', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('review_requests').select('id,channel,status,rating,feedback,sent_at,completed_at,created_at,customer_id,customers(display_name),job_id').eq('workspace_id', req.workspaceId!).order('created_at',{ascending:false}).limit(300);
  if (error) return res.status(500).json({ error: 'REVIEW_LIST_FAILED' });
  res.json({ reviews: data ?? [] });
}));

router.get('/attribution', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const db = createUserClient(req.auth!.accessToken);
  const { data, error } = await db.from('revenue_attributions').select('source,medium,touch_type,revenue_cents,created_at,lead_id,job_id,payment_id').eq('workspace_id', req.workspaceId!).order('created_at',{ascending:false}).limit(1000);
  if (error) return res.status(500).json({ error: 'ATTRIBUTION_LIST_FAILED' });
  const groups = new Map<string,{source:string,revenueCents:number,conversions:number}>();
  for (const row of data ?? []) { const key=row.source||'Unknown'; const current=groups.get(key)||{source:key,revenueCents:0,conversions:0}; current.revenueCents+=Number(row.revenue_cents||0); current.conversions+=1; groups.set(key,current); }
  res.json({ sources:[...groups.values()].sort((a,b)=>b.revenueCents-a.revenueCents), events:data??[] });
}));

export default router;
