begin;

create extension if not exists pgcrypto;

create table if not exists public.waitlist_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  content_goals text,
  source text,
  status text not null default 'waitlist',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mvp_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  user_id uuid references auth.users(id) on delete set null,
  lead_id uuid references public.waitlist_leads(id) on delete set null,
  plan_id uuid,
  path text,
  user_agent text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mvp_events_event_name_idx on public.mvp_events(event_name);
create index if not exists mvp_events_user_id_idx on public.mvp_events(user_id);
create index if not exists mvp_events_plan_id_idx on public.mvp_events(plan_id);
create index if not exists waitlist_leads_created_at_idx on public.waitlist_leads(created_at desc);

create or replace function public.set_waitlist_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists waitlist_leads_set_updated_at on public.waitlist_leads;
create trigger waitlist_leads_set_updated_at
before update on public.waitlist_leads
for each row
execute function public.set_waitlist_updated_at();

alter table public.waitlist_leads enable row level security;
alter table public.mvp_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'waitlist_leads'
      and policyname = 'waitlist_leads_service_role_all'
  ) then
    create policy waitlist_leads_service_role_all
      on public.waitlist_leads
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mvp_events'
      and policyname = 'mvp_events_service_role_all'
  ) then
    create policy mvp_events_service_role_all
      on public.mvp_events
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end;
$$;

commit;
