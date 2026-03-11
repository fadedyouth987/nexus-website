select 'organizations' as entity, count(*) as total from public.organizations
union all
select 'org_members_v2', count(*) from public.org_members_v2
union all
select 'default_workspaces_v2', count(*) from public.workspaces_v2 where legacy_workspace_id like 'org-default:%'
union all
select 'legacy_influencers', count(*) from public.influencers
union all
select 'legacy_creators', count(*) from public.creators
union all
select 'creators_v2', count(*) from public.creators_v2;

select count(*) as missing_influencer_links
from public.influencers legacy
left join public.creators_v2 current on current.legacy_creator_id = legacy.id::text
where current.id is null;

select count(*) as missing_creator_links
from public.creators legacy
left join public.creators_v2 current on current.legacy_creator_id = legacy.id
where current.id is null;

select set_config('request.jwt.claim.role', 'authenticated', true);

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);
select auth.uid() as acting_user_a;
select org_id, role from public.org_members_v2 order by created_at;
select id, org_id, workspace_id, name from public.creators_v2 order by created_at;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', true);
select auth.uid() as acting_user_b;
select org_id, role from public.org_members_v2 order by created_at;
select id, org_id, workspace_id, name from public.creators_v2 order by created_at;
