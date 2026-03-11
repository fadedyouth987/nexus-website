create extension if not exists pgcrypto;

-- Ensure public.models has is_nsfw and required_verification_level (idempotent: safe if table is new or already had them)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'models') then
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'models' and column_name = 'is_nsfw') then
      alter table public.models add column is_nsfw boolean not null default false;
    end if;
    if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'models' and column_name = 'required_verification_level') then
      alter table public.models add column required_verification_level int not null default 0 check (required_verification_level between 0 and 2);
    end if;
  end if;
end $$;

-- Ensure trigger function exists (may already exist from 0001_blueprint_exec_layer)
create or replace function public.blueprint_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (type in ('checkpoint', 'lora', 'vae')),
  file_path text not null,
  file_size bigint not null check (file_size >= 0),
  is_nsfw boolean not null default false,
  required_verification_level int not null default 0 check (required_verification_level between 0 and 2),
  status text not null default 'PENDING',
  meta_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists models_file_path_key on public.models (file_path);
create index if not exists models_user_created_idx on public.models (user_id, created_at desc);
create index if not exists models_nsfw_level_idx on public.models (is_nsfw, required_verification_level, created_at desc);

drop trigger if exists trg_models_updated_at on public.models;
create trigger trg_models_updated_at
before update on public.models
for each row execute function public.blueprint_set_updated_at();

create table if not exists public.user_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level int not null default 0 check (level between 0 and 2),
  provider text,
  provider_ref text,
  status text not null default 'PENDING',
  created_at timestamptz not null default now()
);

create index if not exists user_verifications_user_level_idx
on public.user_verifications (user_id, level desc, created_at desc);

create table if not exists public.sms_otp_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
  otp_hash text not null,
  attempts int not null default 0 check (attempts between 0 and 5),
  send_attempt int not null default 1 check (send_attempt > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  consumed_at timestamptz
);

create index if not exists sms_otp_codes_phone_created_idx
on public.sms_otp_codes (phone_e164, created_at desc);

create index if not exists sms_otp_codes_user_phone_created_idx
on public.sms_otp_codes (user_id, phone_e164, created_at desc);

create table if not exists public.subscription_tiers_aud (
  code text primary key check (code in ('starter', 'pro', 'scale', 'enterprise')),
  monthly_price_aud numeric(10,2),
  included_gpu_hours numeric(10,2) not null,
  included_credits int not null,
  description text,
  features_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.subscription_tiers_aud (
  code,
  monthly_price_aud,
  included_gpu_hours,
  included_credits,
  description,
  features_json
)
values
  (
    'starter',
    49.00,
    0.5,
    110,
    'Basic uploads, SFW + Level 1, queued jobs.',
    '{"queue":"standard","nsfw":"level1","analytics":"basic"}'::jsonb
  ),
  (
    'pro',
    279.00,
    10.0,
    2200,
    'Priority queue, batch jobs, analytics.',
    '{"queue":"priority","nsfw":"level1","analytics":"advanced"}'::jsonb
  ),
  (
    'scale',
    1099.00,
    50.0,
    11000,
    'Team seats, scheduled campaigns.',
    '{"queue":"priority","team_seats":"included","campaigns":"scheduled"}'::jsonb
  ),
  (
    'enterprise',
    null,
    0.0,
    0,
    'Committed capacity, SLAs, SSO, compliance, reserved GPU pools.',
    '{"queue":"reserved","sso":"required","sla":"custom"}'::jsonb
  )
on conflict (code) do update set
  monthly_price_aud = excluded.monthly_price_aud,
  included_gpu_hours = excluded.included_gpu_hours,
  included_credits = excluded.included_credits,
  description = excluded.description,
  features_json = excluded.features_json,
  updated_at = now();

create or replace function public.user_verification_level()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(max(level), 0)::int
  from public.user_verifications
  where user_id = auth.uid()
    and status = 'VERIFIED';
$$;

grant execute on function public.user_verification_level() to authenticated, anon;

alter table public.models enable row level security;
alter table public.user_verifications enable row level security;
alter table public.sms_otp_codes enable row level security;
alter table public.subscription_tiers_aud enable row level security;

drop policy if exists "models_select_policy" on public.models;
create policy "models_select_policy"
on public.models
for select
using (
  user_id = auth.uid()
  or (
    auth.uid() is not null
    and (
      is_nsfw = false
      or required_verification_level <= public.user_verification_level()
    )
  )
);

drop policy if exists "models_owner_insert" on public.models;
create policy "models_owner_insert"
on public.models
for insert
with check (user_id = auth.uid());

drop policy if exists "models_owner_update" on public.models;
create policy "models_owner_update"
on public.models
for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "models_owner_delete" on public.models;
create policy "models_owner_delete"
on public.models
for delete
using (user_id = auth.uid());

drop policy if exists "verifications_owner" on public.user_verifications;
create policy "verifications_owner"
on public.user_verifications
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "sms_otp_owner_crud" on public.sms_otp_codes;
create policy "sms_otp_owner_crud"
on public.sms_otp_codes
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "subscription_tiers_read_authenticated" on public.subscription_tiers_aud;
create policy "subscription_tiers_read_authenticated"
on public.subscription_tiers_aud
for select
using (auth.uid() is not null);

select '20260305_models_and_verification.sql finished' as ok;
