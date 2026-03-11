create extension if not exists pgcrypto;

-- Organizations and organization_members must exist before org_members_v2 (referenced by FKs)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Default',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.org_members_v2 (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  legacy_member_id uuid null references public.organization_members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists public.workspaces_v2 (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  client_visible boolean not null default false,
  legacy_workspace_id text null,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members_v2 (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces_v2(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.creators_v2 (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces_v2(id) on delete cascade,
  name text not null,
  handle text null,
  niche text null,
  brand_profile jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  legacy_creator_id text null,
  created_at timestamptz not null default now()
);

create table if not exists public.content_v2 (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces_v2(id) on delete cascade,
  creator_id uuid not null references public.creators_v2(id) on delete cascade,
  type text not null check (type in ('image', 'video', 'audio', 'caption', 'post')),
  status text not null check (status in ('draft', 'internal_review', 'client_review', 'scheduled', 'published', 'failed', 'archived')),
  data jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id) on delete restrict,
  legacy_source text null,
  legacy_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedules_v2 (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces_v2(id) on delete cascade,
  content_id uuid not null references public.content_v2(id) on delete cascade,
  platform text null,
  scheduled_for timestamptz null,
  status text not null check (status in ('queued', 'scheduled', 'published', 'failed', 'canceled')),
  error jsonb not null default '{}'::jsonb,
  legacy_post_id uuid null references public.posts(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.performance_v2 (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces_v2(id) on delete cascade,
  content_id uuid not null references public.content_v2(id) on delete cascade,
  platform text null,
  views integer not null default 0,
  engagement integer not null default 0,
  revenue numeric not null default 0,
  recorded_at timestamptz not null default now()
);

alter table public.org_members_v2
  add column if not exists legacy_member_id uuid null references public.organization_members(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

alter table public.workspaces_v2
  add column if not exists client_visible boolean not null default false,
  add column if not exists legacy_workspace_id text null,
  add column if not exists created_at timestamptz not null default now();

alter table public.workspace_members_v2
  add column if not exists org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists created_at timestamptz not null default now();

alter table public.creators_v2
  add column if not exists handle text null,
  add column if not exists niche text null,
  add column if not exists brand_profile jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'active',
  add column if not exists legacy_creator_id text null,
  add column if not exists created_at timestamptz not null default now();

alter table public.content_v2
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists legacy_source text null,
  add column if not exists legacy_id text null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.schedules_v2
  add column if not exists error jsonb not null default '{}'::jsonb,
  add column if not exists legacy_post_id uuid null references public.posts(id) on delete set null,
  add column if not exists created_at timestamptz not null default now();

alter table public.performance_v2
  add column if not exists platform text null,
  add column if not exists views integer not null default 0,
  add column if not exists engagement integer not null default 0,
  add column if not exists revenue numeric not null default 0,
  add column if not exists recorded_at timestamptz not null default now();

create index if not exists idx_org_members_v2_user on public.org_members_v2 (user_id, org_id);
create index if not exists idx_workspaces_v2_org on public.workspaces_v2 (org_id, created_at desc);
create unique index if not exists idx_workspaces_v2_org_name on public.workspaces_v2 (org_id, lower(name));
create index if not exists idx_workspace_members_v2_user on public.workspace_members_v2 (user_id, workspace_id);
create index if not exists idx_workspace_members_v2_org on public.workspace_members_v2 (org_id, user_id);
create index if not exists idx_creators_v2_workspace on public.creators_v2 (workspace_id, created_at desc);
create index if not exists idx_creators_v2_org on public.creators_v2 (org_id, workspace_id);
create index if not exists idx_creators_v2_legacy on public.creators_v2 (legacy_creator_id) where legacy_creator_id is not null;
create index if not exists idx_content_v2_workspace on public.content_v2 (workspace_id, created_at desc);
create index if not exists idx_content_v2_creator on public.content_v2 (creator_id, created_at desc);
create index if not exists idx_content_v2_legacy on public.content_v2 (legacy_source, legacy_id) where legacy_id is not null;
create index if not exists idx_schedules_v2_content on public.schedules_v2 (content_id, scheduled_for);
create index if not exists idx_schedules_v2_workspace on public.schedules_v2 (workspace_id, scheduled_for);
create index if not exists idx_performance_v2_content on public.performance_v2 (content_id, recorded_at desc);

select '0003_v2_agency_tables.sql finished' as ok;
