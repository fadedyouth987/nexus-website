begin;

insert into public.org_members_v2 (org_id, user_id, role, legacy_member_id)
select
  member.org_id,
  member.user_id,
  case
    when member.role in ('owner', 'admin', 'editor', 'viewer') then member.role
    else 'viewer'
  end,
  member.id
from public.organization_members member
join auth.users auth_user on auth_user.id = member.user_id
on conflict (org_id, user_id) do update
set
  role = excluded.role,
  legacy_member_id = coalesce(public.org_members_v2.legacy_member_id, excluded.legacy_member_id);

with creator_users as (
  select distinct creator.user_id
  from public.creators creator
  where creator.user_id is not null
),
users_without_org as (
  select creator_users.user_id
  from creator_users
  left join public.org_members_v2 member on member.user_id = creator_users.user_id
  where member.user_id is null
)
insert into public.organizations (name, slug)
select
  coalesce(auth_user.email, users_without_org.user_id::text) || ' org',
  'personal-' || users_without_org.user_id::text
from users_without_org
left join auth.users auth_user on auth_user.id = users_without_org.user_id
on conflict (slug) do update
set name = excluded.name;

with users_without_org as (
  select creator.user_id
  from public.creators creator
  join public.organizations organization on organization.slug = 'personal-' || creator.user_id::text
  group by creator.user_id
)
insert into public.org_members_v2 (org_id, user_id, role)
select
  organization.id,
  users_without_org.user_id,
  'owner'
from users_without_org
join public.organizations organization on organization.slug = 'personal-' || users_without_org.user_id::text
on conflict (org_id, user_id) do nothing;

insert into public.workspaces_v2 (org_id, name, client_visible, legacy_workspace_id)
select
  organization.id,
  'Default',
  false,
  'org-default:' || organization.id::text
from public.organizations organization
where not exists (
  select 1
  from public.workspaces_v2 workspace
  where workspace.org_id = organization.id
    and workspace.legacy_workspace_id = 'org-default:' || organization.id::text
);

insert into public.workspace_members_v2 (org_id, workspace_id, user_id, role)
select
  member.org_id,
  workspace.id,
  member.user_id,
  member.role
from public.org_members_v2 member
join public.workspaces_v2 workspace
  on workspace.org_id = member.org_id
 and workspace.legacy_workspace_id = 'org-default:' || member.org_id::text
on conflict (workspace_id, user_id) do update
set role = excluded.role;

insert into public.workspaces_v2 (org_id, name, client_visible, legacy_workspace_id)
select
  member.org_id,
  'Imported ' || workspace.id::text,
  false,
  workspace.id::text
from public.workspaces workspace
join public.org_members_v2 member
  on workspace.owner_user_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
 and member.user_id = workspace.owner_user_id::uuid
where workspace.id is not null
  and not exists (
    select 1
    from public.workspaces_v2 existing
    where existing.legacy_workspace_id = workspace.id::text
  );

insert into public.creators_v2 (
  org_id,
  workspace_id,
  name,
  handle,
  niche,
  brand_profile,
  status,
  legacy_creator_id
)
select
  influencer.org_id,
  workspace.id,
  influencer.name,
  influencer.handle,
  influencer.niche,
  jsonb_build_object(
    'source', 'influencers',
    'lora_model_path', influencer.lora_model_path,
    'voice_id', influencer.voice_id,
    'personality_system_prompt', influencer.personality_system_prompt,
    'safety_lock', influencer.safety_lock
  ),
  case when influencer.is_active then 'active' else 'archived' end,
  influencer.id::text
from public.influencers influencer
join public.workspaces_v2 workspace
  on workspace.org_id = influencer.org_id
 and workspace.legacy_workspace_id = 'org-default:' || influencer.org_id::text
where not exists (
  select 1
  from public.creators_v2 creator
  where creator.legacy_creator_id = influencer.id::text
);

insert into public.creators_v2 (
  org_id,
  workspace_id,
  name,
  handle,
  niche,
  brand_profile,
  status,
  legacy_creator_id
)
select
  member.org_id,
  workspace.id,
  creator.name,
  creator.handle,
  creator.niche,
  jsonb_build_object(
    'source', 'creators',
    'bio', creator.bio,
    'style_template', creator.style_template,
    'vault_mode', creator.vault_mode
  ),
  creator.status,
  creator.id
from public.creators creator
join public.org_members_v2 member on member.user_id = creator.user_id
join public.workspaces_v2 workspace
  on workspace.org_id = member.org_id
 and workspace.legacy_workspace_id = 'org-default:' || member.org_id::text
where not exists (
  select 1
  from public.creators_v2 creator_v2
  where creator_v2.legacy_creator_id = creator.id
);

commit;
