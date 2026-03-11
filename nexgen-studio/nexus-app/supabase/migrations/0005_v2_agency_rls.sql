alter table public.org_members_v2 enable row level security;
alter table public.workspaces_v2 enable row level security;
alter table public.workspace_members_v2 enable row level security;
alter table public.creators_v2 enable row level security;
alter table public.content_v2 enable row level security;
alter table public.schedules_v2 enable row level security;
alter table public.performance_v2 enable row level security;

drop policy if exists "org_members_v2_select" on public.org_members_v2;
create policy "org_members_v2_select"
on public.org_members_v2
for select
using (public.has_org_role_v2(org_id));

drop policy if exists "org_members_v2_manage" on public.org_members_v2;
create policy "org_members_v2_manage"
on public.org_members_v2
for all
using (public.has_org_role_v2(org_id, array['owner', 'admin']))
with check (public.has_org_role_v2(org_id, array['owner', 'admin']));

drop policy if exists "workspaces_v2_select" on public.workspaces_v2;
create policy "workspaces_v2_select"
on public.workspaces_v2
for select
using (public.has_org_role_v2(org_id));

drop policy if exists "workspaces_v2_manage" on public.workspaces_v2;
create policy "workspaces_v2_manage"
on public.workspaces_v2
for all
using (public.has_org_role_v2(org_id, array['owner', 'admin']))
with check (public.has_org_role_v2(org_id, array['owner', 'admin']));

drop policy if exists "workspace_members_v2_select" on public.workspace_members_v2;
create policy "workspace_members_v2_select"
on public.workspace_members_v2
for select
using (public.has_org_role_v2(org_id));

drop policy if exists "workspace_members_v2_manage" on public.workspace_members_v2;
create policy "workspace_members_v2_manage"
on public.workspace_members_v2
for all
using (
  public.has_org_role_v2(org_id, array['owner', 'admin'])
  or public.has_workspace_role_v2(workspace_id, array['owner', 'admin'])
)
with check (
  public.has_org_role_v2(org_id, array['owner', 'admin'])
  or public.has_workspace_role_v2(workspace_id, array['owner', 'admin'])
);

drop policy if exists "creators_v2_select" on public.creators_v2;
create policy "creators_v2_select"
on public.creators_v2
for select
using (
  public.has_org_role_v2(org_id)
  and public.has_workspace_role_v2(workspace_id)
);

drop policy if exists "creators_v2_insert" on public.creators_v2;
create policy "creators_v2_insert"
on public.creators_v2
for insert
with check (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
);

drop policy if exists "creators_v2_update" on public.creators_v2;
create policy "creators_v2_update"
on public.creators_v2
for update
using (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
)
with check (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
);

drop policy if exists "creators_v2_delete" on public.creators_v2;
create policy "creators_v2_delete"
on public.creators_v2
for delete
using (
  public.has_org_role_v2(org_id, array['owner', 'admin'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin'])
);

drop policy if exists "content_v2_select" on public.content_v2;
create policy "content_v2_select"
on public.content_v2
for select
using (
  public.has_org_role_v2(org_id)
  and public.has_workspace_role_v2(workspace_id)
);

drop policy if exists "content_v2_manage" on public.content_v2;
create policy "content_v2_manage"
on public.content_v2
for all
using (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
)
with check (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
);

drop policy if exists "schedules_v2_select" on public.schedules_v2;
create policy "schedules_v2_select"
on public.schedules_v2
for select
using (
  public.has_org_role_v2(org_id)
  and public.has_workspace_role_v2(workspace_id)
);

drop policy if exists "schedules_v2_manage" on public.schedules_v2;
create policy "schedules_v2_manage"
on public.schedules_v2
for all
using (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
)
with check (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
);

drop policy if exists "performance_v2_select" on public.performance_v2;
create policy "performance_v2_select"
on public.performance_v2
for select
using (
  public.has_org_role_v2(org_id)
  and public.has_workspace_role_v2(workspace_id)
);

drop policy if exists "performance_v2_manage" on public.performance_v2;
create policy "performance_v2_manage"
on public.performance_v2
for all
using (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
)
with check (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
);

select '0005_v2_agency_rls.sql finished' as ok;
