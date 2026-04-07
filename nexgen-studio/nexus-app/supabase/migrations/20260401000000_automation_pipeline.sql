-- Automation-grade durable pipeline schema
-- Adds: idempotency, dead letter queue, webhook delivery, scheduled jobs,
--        automation runs, circuit breaker state, asset transformations,
--        content moderation, audit trail enrichment, priority queues

-- ==========================================
-- Idempotency Keys
-- ==========================================
create table if not exists public.idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  org_id uuid references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  request_method text not null default 'POST',
  request_path text not null,
  request_body jsonb,
  response_status integer,
  response_body jsonb,
  status text not null check (status in ('pending', 'completed', 'expired')) default 'pending',
  job_id uuid references public.generation_jobs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists idx_idempotency_key on public.idempotency_keys (key) where status = 'pending';
create index if not exists idx_idempotency_org on public.idempotency_keys (org_id, created_at desc);

-- ==========================================
-- Dead Letter Queue
-- ==========================================
create table if not exists public.dead_letter_jobs (
  id uuid primary key default gen_random_uuid(),
  original_job_id uuid references public.generation_jobs (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete set null,
  user_id uuid references auth.users (id) on delete set null,
  queue_name text not null default 'generation-jobs',
  error_type text,
  error_message text not null,
  error_stack text,
  attempt_count integer not null default 0,
  max_attempts integer not null default 3,
  original_payload jsonb not null default '{}'::jsonb,
  last_attempt_at timestamptz,
  replay_status text not null check (replay_status in ('pending', 'replaying', 'replayed', 'discarded')) default 'pending',
  replayed_job_id uuid references public.generation_jobs (id) on delete set null,
  replayed_at timestamptz,
  replayed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dlq_org on public.dead_letter_jobs (org_id, created_at desc);
create index if not exists idx_dlq_status on public.dead_letter_jobs (replay_status, created_at);
create index if not exists idx_dlq_original on public.dead_letter_jobs (original_job_id);

-- ==========================================
-- Webhook Endpoints (outbound)
-- ==========================================
create table if not exists public.webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  url text not null,
  secret text,
  events text[] not null default '{job.completed,job.failed,job.progress,asset.created}'::text[],
  is_active boolean not null default true,
  headers jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_webhook_org on public.webhook_endpoints (org_id, is_active);

-- ==========================================
-- Webhook Deliveries
-- ==========================================
create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_endpoint_id uuid references public.webhook_endpoints (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete set null,
  event_type text not null,
  payload jsonb not null,
  status text not null check (status in ('pending', 'delivered', 'failed', 'expired')) default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  response_status integer,
  response_body text,
  error_message text,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_webhook_deliveries_pending on public.webhook_deliveries (status, next_retry_at) where status = 'pending';
create index if not exists idx_webhook_deliveries_org on public.webhook_deliveries (org_id, created_at desc);

-- ==========================================
-- Scheduled Jobs (cron-like automation)
-- ==========================================
create table if not exists public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null,
  cron_expression text,
  schedule_type text not null check (schedule_type in ('cron', 'once', 'interval')) default 'cron',
  interval_minutes integer,
  run_at timestamptz,
  job_type text not null default 'generation',
  input_params jsonb not null default '{}'::jsonb,
  status text not null check (status in ('active', 'paused', 'completed', 'cancelled')) default 'active',
  last_run_at timestamptz,
  last_run_status text,
  next_run_at timestamptz,
  run_count integer not null default 0,
  max_runs integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scheduled_org on public.scheduled_jobs (org_id, status);
create index if not exists idx_scheduled_next_run on public.scheduled_jobs (status, next_run_at) where status = 'active';

-- ==========================================
-- Automation Runs (multi-step pipeline tracking)
-- ==========================================
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  automation_type text not null,
  trigger_type text not null check (trigger_type in ('manual', 'scheduled', 'webhook', 'api')),
  trigger_source text,
  status text not null check (status in ('running', 'completed', 'failed', 'cancelled')) default 'running',
  input_params jsonb not null default '{}'::jsonb,
  output_result jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms bigint
);

create table if not exists public.automation_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete set null,
  step_name text not null,
  step_type text not null,
  status text not null check (status in ('pending', 'running', 'completed', 'failed', 'skipped')) default 'pending',
  input_params jsonb default '{}'::jsonb,
  output_result jsonb,
  error_message text,
  job_id uuid references public.generation_jobs (id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms bigint,
  created_at timestamptz not null default now(),
  step_order integer not null default 0
);

create index if not exists idx_automation_runs_org on public.automation_runs (org_id, started_at desc);
create index if not exists idx_automation_run_steps_run on public.automation_run_steps (run_id, step_order);

-- ==========================================
-- Circuit Breaker State
-- ==========================================
create table if not exists public.circuit_breaker_state (
  id uuid primary key default gen_random_uuid(),
  service_name text not null unique,
  state text not null check (state in ('closed', 'open', 'half_open')) default 'closed',
  failure_count integer not null default 0,
  success_count integer not null default 0,
  failure_threshold integer not null default 5,
  success_threshold integer not null default 3,
  timeout_ms integer not null default 30000,
  last_failure_at timestamptz,
  last_success_at timestamptz,
  opened_at timestamptz,
  half_open_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.circuit_breaker_state (service_name, failure_threshold, timeout_ms)
values
  ('comfyui', 5, 30000),
  ('s3', 3, 15000),
  ('supabase', 3, 10000)
on conflict (service_name) do nothing;

-- ==========================================
-- Content Moderation
-- ==========================================
create table if not exists public.content_moderation (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.generated_assets (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete set null,
  job_id uuid references public.generation_jobs (id) on delete set null,
  status text not null check (status in ('pending', 'approved', 'flagged', 'rejected')) default 'pending',
  safety_rating text check (safety_rating in ('safe', 'suggestive', 'explicit', 'unknown')) default 'unknown',
  moderation_provider text,
  moderation_scores jsonb,
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_moderation_asset on public.content_moderation (asset_id);
create index if not exists idx_moderation_status on public.content_moderation (status, created_at);

-- ==========================================
-- Asset Transformations
-- ==========================================
create table if not exists public.asset_transformations (
  id uuid primary key default gen_random_uuid(),
  source_asset_id uuid references public.generated_assets (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete set null,
  transformation_type text not null check (transformation_type in ('thumbnail', 'resize', 'format_convert', 'optimize')),
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')) default 'pending',
  input_params jsonb not null default '{}'::jsonb,
  output_url text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_transformations_source on public.asset_transformations (source_asset_id);
create index if not exists idx_transformations_status on public.asset_transformations (status, created_at);

-- ==========================================
-- Audit Log Enrichment (automation-specific columns)
-- ==========================================
alter table public.audit_logs
  add column if not exists automation_run_id uuid,
  add column if not exists step_id uuid,
  add column if not exists severity text check (severity in ('info', 'warn', 'error', 'critical')) default 'info';

-- ==========================================
-- Generation Jobs: add idempotency_key and priority_queue
-- ==========================================
alter table public.generation_jobs
  add column if not exists idempotency_key text,
  add column if not exists priority_queue text check (priority_queue in ('critical', 'high', 'normal', 'low')) default 'normal',
  add column if not exists webhook_url text,
  add column if not exists metadata jsonb default '{}'::jsonb;

create index if not exists idx_jobs_idempotency on public.generation_jobs (idempotency_key) where idempotency_key is not null;
create index if not exists idx_jobs_priority on public.generation_jobs (priority_queue, status, created_at);

-- ==========================================
-- Functions
-- ==========================================

-- Expire old idempotency keys
create or replace function public.expire_old_idempotency_keys()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.idempotency_keys
  set status = 'expired', updated_at = now()
  where status = 'pending' and expires_at < now();
end;
$$;

-- Retry failed webhook deliveries
create or replace function public.retry_failed_webhook_deliveries()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.webhook_deliveries
  set status = 'pending',
      next_retry_at = now(),
      updated_at = now()
  where status = 'failed'
    and attempt_count < max_attempts
    and (next_retry_at is null or next_retry_at <= now());
end;
$$;

-- Process scheduled jobs that are due
create or replace function public.get_due_scheduled_jobs()
returns table (
  job_id uuid,
  org_id uuid,
  user_id uuid,
  job_type text,
  input_params jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select sj.id, sj.org_id, sj.user_id, sj.job_type, sj.input_params
  from public.scheduled_jobs sj
  where sj.status = 'active'
    and (
      (sj.schedule_type = 'once' and sj.run_at <= now() and sj.run_count = 0)
      or (sj.schedule_type = 'cron' and (sj.next_run_at is null or sj.next_run_at <= now()))
      or (sj.schedule_type = 'interval' and (sj.last_run_at is null or now() - sj.last_run_at > (sj.interval_minutes || ' minutes')::interval))
    )
    and (sj.max_runs is null or sj.run_count < sj.max_runs);
end;
$$;

-- ==========================================
-- RLS Policies
-- ==========================================
alter table public.idempotency_keys enable row level security;
alter table public.dead_letter_jobs enable row level security;
alter table public.webhook_endpoints enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.scheduled_jobs enable row level security;
alter table public.automation_runs enable row level security;
alter table public.automation_run_steps enable row level security;
alter table public.content_moderation enable row level security;
alter table public.asset_transformations enable row level security;

-- Idempotency keys
create policy idempotency_keys_select_org on public.idempotency_keys
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy idempotency_keys_insert_org on public.idempotency_keys
  for insert with check (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

-- Dead letter jobs
create policy dead_letter_jobs_select_org on public.dead_letter_jobs
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy dead_letter_jobs_update_org on public.dead_letter_jobs
  for update using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

-- Webhook endpoints
create policy webhook_endpoints_select_org on public.webhook_endpoints
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy webhook_endpoints_insert_org on public.webhook_endpoints
  for insert with check (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy webhook_endpoints_update_org on public.webhook_endpoints
  for update using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy webhook_endpoints_delete_org on public.webhook_endpoints
  for delete using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

-- Webhook deliveries
create policy webhook_deliveries_select_org on public.webhook_deliveries
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

-- Scheduled jobs
create policy scheduled_jobs_select_org on public.scheduled_jobs
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy scheduled_jobs_insert_org on public.scheduled_jobs
  for insert with check (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy scheduled_jobs_update_org on public.scheduled_jobs
  for update using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy scheduled_jobs_delete_org on public.scheduled_jobs
  for delete using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

-- Automation runs
create policy automation_runs_select_org on public.automation_runs
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy automation_runs_insert_org on public.automation_runs
  for insert with check (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

-- Automation run steps
create policy automation_run_steps_select_org on public.automation_run_steps
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

-- Content moderation
create policy content_moderation_select_org on public.content_moderation
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy content_moderation_update_org on public.content_moderation
  for update using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );

-- Asset transformations
create policy asset_transformations_select_org on public.asset_transformations
  for select using (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
create policy asset_transformations_insert_org on public.asset_transformations
  for insert with check (
    org_id in (select m.org_id from public.organization_members m where m.user_id = (select auth.uid()) and m.is_active)
  );
