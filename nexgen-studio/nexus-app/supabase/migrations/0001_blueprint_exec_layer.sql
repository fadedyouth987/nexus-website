create extension if not exists pgcrypto;

do $$ begin
  create type blueprint_plan_tier as enum ('STARTER','PRO','VAULT','ENTERPRISE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type blueprint_plan_status as enum ('ACTIVE','PAST_DUE','CANCELED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type workflow_type as enum ('IMAGE','VIDEO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type content_policy as enum ('SFW','NSFW');
exception when duplicate_object then null; end $$;

do $$ begin
  create type job_status as enum ('DRAFT','QUEUED','GENERATING','READY','FAILED','CANCELED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_kind as enum ('IMAGE','VIDEO');
exception when duplicate_object then null; end $$;

do $$ begin
  create type asset_visibility as enum ('STANDARD','VAULT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type blueprint_age_verification_method as enum ('SELF_ATTESTED','PROVIDER');
exception when duplicate_object then null; end $$;

create or replace function public.blueprint_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table if not exists public.blueprint_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  plan blueprint_plan_tier not null default 'STARTER',
  plan_status blueprint_plan_status not null default 'ACTIVE',
  plan_renews_at timestamptz,
  age_verified_at timestamptz,
  age_verification_method blueprint_age_verification_method,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blueprint_users_plan_idx
on public.blueprint_users (plan, plan_status);

drop trigger if exists trg_blueprint_users_updated_at on public.blueprint_users;
create trigger trg_blueprint_users_updated_at
before update on public.blueprint_users
for each row execute function public.blueprint_set_updated_at();

create table if not exists public.workflow_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  type workflow_type not null,
  content_policy content_policy not null default 'SFW',
  requires_vault boolean not null default false,
  min_age int not null default 18,
  base_cost_credits int not null default 1,
  comfy_workflow_json jsonb not null default '{}'::jsonb,
  variables_json jsonb not null default '{}'::jsonb,
  ui_schema_json jsonb,
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workflow_templates_active_idx
on public.workflow_templates (type, is_active, content_policy);

drop trigger if exists trg_workflow_templates_updated_at on public.workflow_templates;
create trigger trg_workflow_templates_updated_at
before update on public.workflow_templates
for each row execute function public.blueprint_set_updated_at();

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.blueprint_users(id) on delete cascade,
  organization_id uuid not null,
  influencer_id uuid not null references public.influencers(id) on delete restrict,
  workflow_template_id uuid not null references public.workflow_templates(id),
  mode workflow_type not null,
  legacy_mode text,
  content_policy content_policy not null default 'SFW',
  status job_status not null default 'QUEUED',
  prompt_id text unique,
  progress_json jsonb not null default '{}'::jsonb,
  inputs_json jsonb not null default '{}'::jsonb,
  resolved_workflow_json jsonb,
  policy_decision_json jsonb not null default '{}'::jsonb,
  result_summary_json jsonb not null default '{}'::jsonb,
  error text,
  attempt int not null default 0,
  superseded_by_job_id uuid references public.generation_jobs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generation_jobs_user_status_idx
on public.generation_jobs (user_id, status, created_at desc);

create index if not exists generation_jobs_org_created_idx
on public.generation_jobs (organization_id, created_at desc);

create index if not exists generation_jobs_influencer_idx
on public.generation_jobs (influencer_id, created_at desc);

drop trigger if exists trg_generation_jobs_updated_at on public.generation_jobs;
create trigger trg_generation_jobs_updated_at
before update on public.generation_jobs
for each row execute function public.blueprint_set_updated_at();

create table if not exists public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  generation_job_id uuid not null references public.generation_jobs(id) on delete cascade,
  organization_id uuid not null,
  influencer_id uuid not null references public.influencers(id) on delete restrict,
  kind asset_kind not null,
  asset_variant text not null default 'main',
  visibility asset_visibility not null default 'STANDARD',
  storage_url text not null,
  thumb_storage_url text,
  mime_type text,
  width int,
  height int,
  duration float,
  is_sensitive boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$ begin
  alter table public.generated_assets
  add constraint generated_assets_job_kind_variant_key
  unique (generation_job_id, kind, asset_variant);
exception when duplicate_object then null; end $$;

create index if not exists generated_assets_visibility_org_created_idx
on public.generated_assets (visibility, organization_id, created_at desc);

create index if not exists generated_assets_visibility_influencer_created_idx
on public.generated_assets (visibility, influencer_id, created_at desc);

create index if not exists generated_assets_job_idx
on public.generated_assets (generation_job_id);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.blueprint_users(id) on delete cascade,
  delta int not null,
  reason text not null,
  ref_type text,
  ref_id text,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_idx
on public.credit_ledger (user_id, created_at desc);

create table if not exists public.blueprint_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.blueprint_users(id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists blueprint_audit_logs_user_idx
on public.blueprint_audit_logs (user_id, created_at desc);

create index if not exists blueprint_audit_logs_entity_idx
on public.blueprint_audit_logs (entity_type, entity_id);

alter table public.assets
add column if not exists blueprint_job_asset_key text;

create unique index if not exists assets_blueprint_job_asset_key_idx
on public.assets (blueprint_job_asset_key)
where blueprint_job_asset_key is not null;

alter table public.blueprint_users enable row level security;
alter table public.workflow_templates enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.generated_assets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.blueprint_audit_logs enable row level security;

create or replace function public.blueprint_uid()
returns uuid
language sql
stable
as $$
  select auth.uid();
$$;

drop policy if exists "blueprint_users_select_self" on public.blueprint_users;
create policy "blueprint_users_select_self" on public.blueprint_users
for select using (id = public.blueprint_uid());

drop policy if exists "blueprint_users_update_self" on public.blueprint_users;
create policy "blueprint_users_update_self" on public.blueprint_users
for update using (id = public.blueprint_uid());

drop policy if exists "blueprint_users_insert_self" on public.blueprint_users;
create policy "blueprint_users_insert_self" on public.blueprint_users
for insert with check (id = public.blueprint_uid());

drop policy if exists "workflow_templates_select_active" on public.workflow_templates;
create policy "workflow_templates_select_active" on public.workflow_templates
for select using (is_active = true);

drop policy if exists "generation_jobs_owner_crud" on public.generation_jobs;
create policy "generation_jobs_owner_crud" on public.generation_jobs
for all using (user_id = public.blueprint_uid())
with check (user_id = public.blueprint_uid());

drop policy if exists "generated_assets_owner_select" on public.generated_assets;
create policy "generated_assets_owner_select" on public.generated_assets
for select using (
  exists (
    select 1 from public.generation_jobs j
    where j.id = generation_job_id
      and j.user_id = public.blueprint_uid()
  )
);

drop policy if exists "credit_ledger_owner_select" on public.credit_ledger;
create policy "credit_ledger_owner_select" on public.credit_ledger
for select using (user_id = public.blueprint_uid());

drop policy if exists "credit_ledger_no_client_insert" on public.credit_ledger;
create policy "credit_ledger_no_client_insert" on public.credit_ledger
for insert to authenticated with check (false);

drop policy if exists "blueprint_audit_logs_owner_select" on public.blueprint_audit_logs;
create policy "blueprint_audit_logs_owner_select" on public.blueprint_audit_logs
for select using (user_id = public.blueprint_uid());

drop policy if exists "blueprint_audit_logs_no_client_insert" on public.blueprint_audit_logs;
create policy "blueprint_audit_logs_no_client_insert" on public.blueprint_audit_logs
for insert to authenticated with check (false);

create or replace function public.blueprint_credit_balance(p_user_id uuid)
returns int
language sql
stable
as $$
  select coalesce(sum(delta), 0)::int
  from public.credit_ledger
  where user_id = p_user_id;
$$;

insert into public.workflow_templates (slug, name, type, content_policy, base_cost_credits, comfy_workflow_json, variables_json)
values
  ('sfw-txt2img-v1', 'SFW Text to Image', 'IMAGE', 'SFW', 1, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"negative_prompt":{"node":"7","path":"inputs.text"}}}'::jsonb),
  ('sfw-img2img-v1', 'SFW Image to Image', 'IMAGE', 'SFW', 1, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"input_image_url":{"node":"8","path":"inputs.url"}}}'::jsonb),
  ('sfw-controlnet-v1', 'SFW ControlNet', 'IMAGE', 'SFW', 1, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"},"controlnet_image_url":{"node":"9","path":"inputs.url"}}}'::jsonb),
  ('sfw-upscale-v1', 'SFW Upscale', 'IMAGE', 'SFW', 1, '{}'::jsonb, '{"fields":{"input_image_url":{"node":"8","path":"inputs.url"}}}'::jsonb),
  ('sfw-video-v1', 'SFW Video', 'VIDEO', 'SFW', 2, '{}'::jsonb, '{"fields":{"prompt":{"node":"6","path":"inputs.text"}}}'::jsonb)
on conflict (slug) do nothing;
