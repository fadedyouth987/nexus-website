import { Router } from 'express';
import { asyncRoute } from '../security';
import { requireActiveSubscription, requireAuth, requireWorkspace, supabaseAdmin, type AuthenticatedRequest } from '../supabase';

const router = Router();
router.use(requireAuth, requireWorkspace, requireActiveSubscription('crm.core'));

router.get('/', asyncRoute(async (req: AuthenticatedRequest, res) => {
  const { data: members, error } = await supabaseAdmin
    .from('workspace_members')
    .select('user_id,role,status,created_at')
    .eq('workspace_id', req.workspaceId!)
    .order('created_at');

  if (error) return res.status(500).json({ error: 'TEAM_LIST_FAILED' });

  const userIds = (members ?? []).map((member) => member.user_id);
  let profiles: Array<{ id: string; display_name: string | null; avatar_url: string | null }> = [];

  if (userIds.length) {
    const { data, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id,display_name,avatar_url')
      .in('id', userIds);
    if (profileError) return res.status(500).json({ error: 'TEAM_PROFILE_LIST_FAILED' });
    profiles = data ?? [];
  }

  const profileByUser = new Map(profiles.map((profile) => [profile.id, profile]));
  res.json({
    members: (members ?? []).map((member) => ({
      ...member,
      profile: profileByUser.get(member.user_id) ?? null,
    })),
  });
}));

export default router;
