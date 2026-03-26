-- Nexus initial schema (public). Uses auth.users for identities; profiles mirrors display fields.
-- Runs before 20260322000000_waitlist_signups.sql

-- ==========================================
-- Profiles (1:1 with auth.users)
-- ==========================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  avatar_url text,
  email_verified boolean default false,
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================
-- Subscriptions (defined before organizations FK)
-- ==========================================
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  price_monthly_cents integer not null default 0,
  features jsonb default '{}'::jsonb,
  limits jsonb default '{}'::jsonb,
  stripe_product_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans (name, slug, price_monthly_cents, stripe_product_id)
values
  ('Starter', 'starter', 0, null),
  ('Professional', 'professional', 2900, null),
  ('Enterprise', 'enterprise', 9900, null)
on conflict (slug) do nothing;

-- ==========================================
-- Organizations & membership
-- ==========================================
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique default encode(gen_random_bytes(8), 'hex'),
  plan_id uuid references public.subscription_plans (id),
  subscription_status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text,
  token_balance bigint not null default 1000,
  usage_this_month jsonb not null default '{"generations": 0, "storage_gb": 0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index if not exists organization_members_user_idx on public.organization_members (user_id);

-- ==========================================
-- Influencers & legacy content tables (server actions)
-- ==========================================
create table if not exists public.influencers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  handle text,
  niche text,
  lora_model_path text,
  voice_id text,
  personality_system_prompt text,
  safety_lock boolean not null default true,
  is_active boolean not null default true
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid references public.influencers (id) on delete set null,
  org_id uuid not null references public.organizations (id) on delete cascade,
  url text not null,
  type text check (type in ('image', 'video', 'audio')),
  c2pa_hash text,
  safety_rating text check (safety_rating in ('safe', 'suggestive', 'explicit')),
  is_archived boolean not null default false
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  influencer_id uuid references public.influencers (id) on delete set null,
  asset_id uuid references public.assets (id) on delete set null,
  platform text,
  caption text,
  scheduled_at timestamptz,
  status text check (status in ('draft', 'pending_approval', 'scheduled', 'published', 'failed'))
);

create table if not exists public.fans (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid references public.influencers (id) on delete cascade,
  username text,
  platform text,
  total_spend_cents integer default 0,
  vip_status boolean default false,
  last_interaction timestamptz
);

-- ==========================================
-- AI registry & jobs
-- ==========================================
create table if not exists public.ai_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  display_name text,
  type text not null check (type in ('checkpoint', 'lora', 'vae', 'controlnet', 'embedding')),
  file_path text not null,
  file_size_bytes bigint,
  base_model text,
  preview_url text,
  trigger_words text[],
  is_public boolean not null default false,
  allowed_plans text[] not null default array['starter', 'professional', 'enterprise']::text[],
  usage_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  influencer_id uuid references public.influencers (id) on delete set null,
  job_type text not null default 'image',
  input_params jsonb not null default '{}'::jsonb,
  input_images text[],
  status text not null default 'queued',
  priority integer not null default 0,
  progress integer not null default 0,
  server_id uuid,
  comfyui_prompt_id text,
  output_images jsonb not null default '[]'::jsonb,
  seed_used bigint,
  started_at timestamptz,
  completed_at timestamptz,
  processing_time_ms bigint,
  error_message text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jobs_queued
  on public.generation_jobs (status, priority, created_at)
  where status = 'queued';

create index if not exists idx_jobs_processing
  on public.generation_jobs (server_id)
  where status = 'processing';

create index if not exists idx_jobs_user
  on public.generation_jobs (user_id, created_at desc);

create table if not exists public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  job_id uuid references public.generation_jobs (id) on delete cascade,
  url text not null,
  thumbnail_url text,
  file_type text not null default 'image',
  width integer,
  height integer,
  file_size_bytes bigint,
  prompt text,
  negative_prompt text,
  seed bigint,
  model_used text,
  generation_params jsonb not null default '{}'::jsonb,
  safety_rating text not null default 'safe',
  moderation_status text not null default 'approved',
  is_favorite boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_assets_org on public.generated_assets (org_id, created_at desc);
create index if not exists idx_assets_user on public.generated_assets (user_id, created_at desc);

create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete cascade,
  name text not null,
  description text,
  category text not null,
  workflow_json jsonb not null,
  default_values jsonb not null default '{}'::jsonb,
  thumbnail_url text,
  is_public boolean not null default false,
  is_featured boolean not null default false,
  usage_count integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  month_year text not null,
  generations_count integer not null default 0,
  storage_used_gb numeric(10, 3) not null default 0,
  created_at timestamptz not null default now(),
  unique (org_id, month_year)
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  resource_type text,
  resource_id uuid,
  target_resource text,
  details jsonb,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default now(),
  timestamp timestamptz default now()
);

create index if not exists idx_audit_org on public.audit_logs (org_id, occurred_at desc);
create index if not exists idx_audit_actor on public.audit_logs (actor_id, occurred_at desc);

-- ==========================================
-- Usage trigger
-- ==========================================
create or replace function public.increment_monthly_usage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.monthly_usage (org_id, month_year, generations_count)
  values (new.org_id, to_char(new.created_at at time zone 'utc', 'YYYY-MM'), 1)
  on conflict (org_id, month_year)
  do update set generations_count = public.monthly_usage.generations_count + 1;
  return new;
end;
$$;

drop trigger if exists track_generation_usage on public.generation_jobs;
create trigger track_generation_usage
  after insert on public.generation_jobs
  for each row
  execute function public.increment_monthly_usage();

-- ==========================================
-- Row Level Security
-- ==========================================
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.influencers enable row level security;
alter table public.assets enable row level security;
alter table public.posts enable row level security;
alter table public.fans enable row level security;
alter table public.ai_models enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.generated_assets enable row level security;
alter table public.workflow_templates enable row level security;
alter table public.monthly_usage enable row level security;
alter table public.audit_logs enable row level security;
alter table public.subscription_plans enable row level security;

-- Profiles
create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid()));

-- Org membership visibility
create policy org_members_select_self on public.organization_members
  for select using (user_id = (select auth.uid()));

create policy orgs_select_member on public.organizations
  for select using (
    id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()))
  );

-- Mutations for org owners/admins (simplified: any active member can insert influencers/assets in their org)
create policy influencers_select_member on public.influencers
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy influencers_insert_member on public.influencers
  for insert with check (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy influencers_update_member on public.influencers
  for update using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

create policy assets_select_member on public.assets
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy assets_insert_member on public.assets
  for insert with check (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

create policy posts_all_member on public.posts
  for all using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  )
  with check (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

create policy fans_select_member on public.fans
  for select using (
    influencer_id in (
      select i.id from public.influencers i
      join public.organization_members m on m.org_id = i.org_id
      where m.user_id = (select auth.uid()) and m.is_active
    )
  );

create policy subscription_plans_read on public.subscription_plans
  for select using (is_active = true);

-- Allow authenticated clients to read the catalog; app filters by plan / is_public.
create policy ai_models_select_authenticated on public.ai_models
  for select using ((select auth.uid()) is not null);

create policy generation_jobs_select_org on public.generation_jobs
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy generation_jobs_insert_org on public.generation_jobs
  for insert with check (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy generation_jobs_update_org on public.generation_jobs
  for update using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

create policy generated_assets_select_org on public.generated_assets
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy generated_assets_update_org on public.generated_assets
  for update using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

create policy workflow_templates_select on public.workflow_templates
  for select using (
    is_public = true
    or org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

create policy monthly_usage_select_org on public.monthly_usage
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

create policy audit_logs_select_org on public.audit_logs
  for select using (
    org_id is null
    or org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

create policy audit_logs_insert_actor on public.audit_logs
  for insert with check (actor_id = (select auth.uid()));

create policy fans_insert_member on public.fans
  for insert with check (
    influencer_id in (
      select i.id from public.influencers i
      join public.organization_members m on m.org_id = i.org_id
      where m.user_id = (select auth.uid()) and m.is_active
    )
  );

-- Allow authenticated users to create organizations (first org signup flow)
create policy organizations_insert_authenticated on public.organizations
  for insert with check ((select auth.uid()) is not null);

create policy organization_members_insert_self on public.organization_members
  for insert with check (user_id = (select auth.uid()));

-- Service role bypasses RLS by default in Supabase.

comment on table public.profiles is 'App profile row; id matches auth.users.id';
