create extension if not exists pgcrypto;

create table if not exists public.edit_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id text not null,
  tool text not null,
  params_json jsonb not null default '{}'::jsonb,
  recipe_name text null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'canceled')),
  output_asset_id text null,
  error_message text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists edit_jobs_user_created_idx on public.edit_jobs (user_id, created_at desc);
create index if not exists edit_jobs_status_idx on public.edit_jobs (status, created_at desc);

drop trigger if exists trg_edit_jobs_updated_at on public.edit_jobs;
create trigger trg_edit_jobs_updated_at
  before update on public.edit_jobs
  for each row execute function public.blueprint_set_updated_at();

alter table public.edit_jobs enable row level security;

drop policy if exists edit_jobs_owner_all on public.edit_jobs;
create policy edit_jobs_owner_all on public.edit_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

select '20260308_edit_jobs.sql finished' as ok;

