import { Router } from 'express';
import { asyncRoute } from '../security';
import { requireActiveSubscription, requireAuth, requireWorkspace, supabaseAdmin, type AuthenticatedRequest } from '../supabase';

const router = Router();
router.use(requireAuth, requireWorkspace, requireActiveSubscription('crm.core'));

router.get('/', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const { data, error } = await supabaseAdmin.from('integrations').select('id,provider,status,external_account_id,scopes,last_success_at,last_error_at,error_code,connected_at,updated_at').eq('workspace_id', req.workspaceId!).order('provider');
  if (error) return res.status(500).json({ error: 'INTEGRATION_LIST_FAILED' });
  res.json({ integrations: data ?? [] });
}));

export default router;
