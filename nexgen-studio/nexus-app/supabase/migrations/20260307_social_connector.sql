-- Social Media Connector: accounts, publish jobs, webhook events, analytics snapshots

create extension if not exists pgcrypto;

create table if not exists public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in (
    'instagram', 'facebook', 'tiktok', 'twitter', 'youtube', 'linkedin', 'pinterest', 'reddit'
  )),
  account_name text not null,
  account_id text not null,
  access_token_encrypted text not null,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, account_id)
);

create index if not exists social_accounts_user_id_idx on public.social_accounts (user_id);
create index if not exists social_accounts_provider_idx on public.social_accounts (provider);

create table if not exists public.publish_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  provider text not null,
  post_content text not null default '',
  media_urls text[] default '{}',
  scheduled_for timestamptz,
  status text not null default 'pending' check (status in (
    'pending', 'queued', 'publishing', 'published', 'failed', 'canceled'
  )),
  error_message text,
  published_at timestamptz,
  external_post_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publish_jobs_user_id_idx on public.publish_jobs (user_id);
create index if not exists publish_jobs_social_account_id_idx on public.publish_jobs (social_account_id);
create index if not exists publish_jobs_scheduled_for_idx on public.publish_jobs (scheduled_for) where status in ('pending', 'queued');
create index if not exists publish_jobs_status_idx on public.publish_jobs (status);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now(),
  processed boolean not null default false,
  processed_at timestamptz
);

create index if not exists webhook_events_provider_received_idx on public.webhook_events (provider, received_at desc);
create index if not exists webhook_events_processed_idx on public.webhook_events (processed) where not processed;

create table if not exists public.analytics_snapshots (
  id uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  provider text not null,
  metric_type text not null,
  metric_value numeric not null,
  captured_at timestamptz not null default now()
);

create index if not exists analytics_snapshots_account_captured_idx on public.analytics_snapshots (social_account_id, captured_at desc);

alter table public.social_accounts enable row level security;
alter table public.publish_jobs enable row level security;
alter table public.webhook_events enable row level security;
alter table public.analytics_snapshots enable row level security;

drop policy if exists "social_accounts_owner_all" on public.social_accounts;
create policy "social_accounts_owner_all" on public.social_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "publish_jobs_owner_all" on public.publish_jobs;
create policy "publish_jobs_owner_all" on public.publish_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "webhook_events_service" on public.webhook_events;
create policy "webhook_events_service" on public.webhook_events
  for all using (true);

drop policy if exists "analytics_snapshots_owner_select" on public.analytics_snapshots;
create policy "analytics_snapshots_owner_select" on public.analytics_snapshots
  for select using (
    exists (select 1 from public.social_accounts sa where sa.id = social_account_id and sa.user_id = auth.uid())
  );

select '20260307_social_connector.sql finished' as ok;
