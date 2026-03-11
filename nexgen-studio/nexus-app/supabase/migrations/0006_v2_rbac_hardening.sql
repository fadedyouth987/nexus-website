alter table public.creators_v2
  add column if not exists voice text null,
  add column if not exists legacy_id text null;

alter table public.schedules_v2
  add column if not exists legacy_id text null;

alter table public.performance_v2
  add column if not exists legacy_id text null;

update public.creators_v2
set legacy_id = legacy_creator_id
where legacy_id is null
  and legacy_creator_id is not null;

update public.schedules_v2
set legacy_id = coalesce(legacy_id, legacy_post_id::text)
where legacy_post_id is not null;

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid null references public.workspaces_v2(id) on delete set null,
  actor_id uuid null references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_org_created_at on public.activity_log (org_id, created_at desc);
create index if not exists idx_activity_log_workspace_created_at on public.activity_log (workspace_id, created_at desc);
create index if not exists idx_activity_log_entity on public.activity_log (entity_type, entity_id);

create or replace function public.can_viewer_approve_content_v2(
  target_content_id uuid,
  target_org_id uuid,
  target_workspace_id uuid,
  target_creator_id uuid,
  target_type text,
  target_created_by uuid,
  next_status text,
  next_data jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.content_v2 existing
    where existing.id = target_content_id
      and existing.org_id = target_org_id
      and existing.workspace_id = target_workspace_id
      and existing.creator_id = target_creator_id
      and existing.type = target_type
      and existing.created_by = target_created_by
      and existing.data is not distinct from next_data
      and existing.status = 'client_review'
      and next_status = 'internal_review'
  );
$$;

grant execute on function public.can_viewer_approve_content_v2(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  uuid,
  text,
  jsonb
) to authenticated, service_role;

alter table public.activity_log enable row level security;

drop policy if exists "content_v2_manage" on public.content_v2;
drop policy if exists "content_v2_insert_editor" on public.content_v2;
drop policy if exists "content_v2_update_editor" on public.content_v2;
drop policy if exists "content_v2_delete_admin" on public.content_v2;
drop policy if exists "content_v2_update_viewer_approval" on public.content_v2;

create policy "content_v2_insert_editor"
on public.content_v2
for insert
with check (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
);

create policy "content_v2_update_editor"
on public.content_v2
for update
using (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
)
with check (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
);

create policy "content_v2_delete_admin"
on public.content_v2
for delete
using (
  public.has_org_role_v2(org_id, array['owner', 'admin'])
  and public.has_workspace_role_v2(workspace_id, array['owner', 'admin'])
);

create policy "content_v2_update_viewer_approval"
on public.content_v2
for update
using (
  public.has_org_role_v2(org_id, array['viewer'])
  and public.has_workspace_role_v2(workspace_id, array['viewer'])
  and status = 'client_review'
)
with check (
  public.has_org_role_v2(org_id, array['viewer'])
  and public.has_workspace_role_v2(workspace_id, array['viewer'])
  and public.can_viewer_approve_content_v2(
    id,
    org_id,
    workspace_id,
    creator_id,
    type,
    created_by,
    status,
    data
  )
);

drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select"
on public.activity_log
for select
using (
  public.has_org_role_v2(org_id)
  and (
    workspace_id is null
    or public.has_workspace_role_v2(workspace_id)
  )
);

drop policy if exists "activity_log_insert" on public.activity_log;
create policy "activity_log_insert"
on public.activity_log
for insert
with check (
  public.has_org_role_v2(org_id, array['owner', 'admin', 'editor'])
  and (
    workspace_id is null
    or public.has_workspace_role_v2(workspace_id, array['owner', 'admin', 'editor'])
  )
);

select '0006_v2_rbac_hardening.sql finished' as ok;
