create or replace function public.tg__touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_content_v2_touch_updated_at on public.content_v2;

create trigger trg_content_v2_touch_updated_at
before update on public.content_v2
for each row
execute function public.tg__touch_updated_at();

create or replace function public.has_org_role_v2(target_org_id uuid, allowed_roles text[] default array['owner', 'admin', 'editor', 'viewer']::text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members_v2 member
    where member.org_id = target_org_id
      and member.user_id = auth.uid()
      and member.role = any (allowed_roles)
  );
$$;

create or replace function public.has_workspace_role_v2(target_workspace_id uuid, allowed_roles text[] default array['owner', 'admin', 'editor', 'viewer']::text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members_v2 member
    where member.workspace_id = target_workspace_id
      and member.user_id = auth.uid()
      and member.role = any (allowed_roles)
  );
$$;

grant execute on function public.has_org_role_v2(uuid, text[]) to authenticated, service_role;
grant execute on function public.has_workspace_role_v2(uuid, text[]) to authenticated, service_role;

select '0004_v2_agency_functions.sql finished' as ok;
