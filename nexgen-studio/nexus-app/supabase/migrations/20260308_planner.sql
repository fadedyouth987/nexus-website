-- 30-day content planner: plans, briefs, strategy, content_items, chat, ai_actions
create extension if not exists pgcrypto;

do $$ begin
  create type planner_plan_status as enum ('draft', 'active', 'approved', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type planner_content_item_status as enum ('draft', 'approved', 'scheduled');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type planner_chat_stage as enum (
    'brief_intake',
    'strategy_synthesis',
    'calendar_generation',
    'calendar_review',
    'asset_preparation',
    'scheduling',
    'optimization'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type planner_version_created_by as enum ('ai', 'user');
exception
  when duplicate_object then null;
end $$;

-- plans: one per 30-day content plan
create table if not exists public.planner_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.blueprint_users(id) on delete cascade,
  name text not null default 'Untitled plan',
  status planner_plan_status not null default 'draft',
  duration_days int not null default 30 check (duration_days > 0 and duration_days <= 365),
  timezone text not null default 'UTC',
  organization_id uuid,
  influencer_id uuid references public.influencers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planner_plans_user_created_idx
  on public.planner_plans (user_id, created_at desc);

drop trigger if exists trg_planner_plans_updated_at on public.planner_plans;
create trigger trg_planner_plans_updated_at
  before update on public.planner_plans
  for each row execute function public.blueprint_set_updated_at();

-- plan_versions: version history
create table if not exists public.planner_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planner_plans(id) on delete cascade,
  version_number int not null,
  change_summary text,
  created_by planner_version_created_by not null default 'ai',
  created_at timestamptz not null default now()
);

create index if not exists planner_plan_versions_plan_idx
  on public.planner_plan_versions (plan_id, version_number desc);

-- plan_briefs: 1:1 with plan, extracted from chat
create table if not exists public.planner_plan_briefs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planner_plans(id) on delete cascade unique,
  niche text,
  tone text,
  audience_json jsonb not null default '[]'::jsonb,
  platforms_json jsonb not null default '[]'::jsonb,
  posting_frequency_json jsonb not null default '{}'::jsonb,
  monetization_goal text,
  visual_style text,
  constraints_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planner_plan_briefs_plan_idx on public.planner_plan_briefs (plan_id);

drop trigger if exists trg_planner_plan_briefs_updated_at on public.planner_plan_briefs;
create trigger trg_planner_plan_briefs_updated_at
  before update on public.planner_plan_briefs
  for each row execute function public.blueprint_set_updated_at();

-- strategy_profiles: 1:1 with plan
create table if not exists public.planner_strategy_profiles (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planner_plans(id) on delete cascade unique,
  content_pillars_json jsonb not null default '[]'::jsonb,
  funnel_stages_json jsonb not null default '[]'::jsonb,
  weekly_rhythm_json jsonb not null default '{}'::jsonb,
  cta_rules_json jsonb not null default '{}'::jsonb,
  brand_rules_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planner_strategy_profiles_plan_idx on public.planner_strategy_profiles (plan_id);

drop trigger if exists trg_planner_strategy_profiles_updated_at on public.planner_strategy_profiles;
create trigger trg_planner_strategy_profiles_updated_at
  before update on public.planner_strategy_profiles
  for each row execute function public.blueprint_set_updated_at();

-- content_items: 30-day calendar rows
create table if not exists public.planner_content_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.planner_plans(id) on delete cascade,
  plan_version_id uuid references public.planner_plan_versions(id) on delete set null,
  day_number int not null check (day_number > 0 and day_number <= 365),
  publish_date date,
  platform text not null default 'instagram',
  slot_number int not null default 1,
  content_pillar text,
  funnel_stage text,
  post_type text,
  title text,
  hook text,
  angle text,
  caption_direction text,
  cta text,
  prompt_seed text,
  status planner_content_item_status not null default 'draft',
  approval_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planner_content_items_plan_day_idx
  on public.planner_content_items (plan_id, day_number);
create index if not exists planner_content_items_plan_platform_idx
  on public.planner_content_items (plan_id, platform);

drop trigger if exists trg_planner_content_items_updated_at on public.planner_content_items;
create trigger trg_planner_content_items_updated_at
  before update on public.planner_content_items
  for each row execute function public.blueprint_set_updated_at();

-- chat_threads: one per conversation
create table if not exists public.planner_chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.blueprint_users(id) on delete cascade,
  plan_id uuid references public.planner_plans(id) on delete set null,
  current_stage planner_chat_stage not null default 'brief_intake',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists planner_chat_threads_user_idx
  on public.planner_chat_threads (user_id, updated_at desc);
create index if not exists planner_chat_threads_plan_idx on public.planner_chat_threads (plan_id);

drop trigger if exists trg_planner_chat_threads_updated_at on public.planner_chat_threads;
create trigger trg_planner_chat_threads_updated_at
  before update on public.planner_chat_threads
  for each row execute function public.blueprint_set_updated_at();

-- chat_messages: one per turn
create table if not exists public.planner_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.planner_chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  message_text text not null default '',
  structured_output_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists planner_chat_messages_thread_idx
  on public.planner_chat_messages (thread_id, created_at);

-- ai_actions: audit of AI-triggered actions
create table if not exists public.planner_ai_actions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid references public.planner_chat_threads(id) on delete set null,
  plan_id uuid references public.planner_plans(id) on delete set null,
  action_type text not null,
  payload_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  status text not null default 'ok',
  created_at timestamptz not null default now()
);

create index if not exists planner_ai_actions_plan_idx on public.planner_ai_actions (plan_id);
create index if not exists planner_ai_actions_thread_idx on public.planner_ai_actions (thread_id);

-- RLS
alter table public.planner_plans enable row level security;
alter table public.planner_plan_versions enable row level security;
alter table public.planner_plan_briefs enable row level security;
alter table public.planner_strategy_profiles enable row level security;
alter table public.planner_content_items enable row level security;
alter table public.planner_chat_threads enable row level security;
alter table public.planner_chat_messages enable row level security;
alter table public.planner_ai_actions enable row level security;

-- plans: user can only access own
drop policy if exists planner_plans_user_all on public.planner_plans;
create policy planner_plans_user_all on public.planner_plans
  for all using (user_id = public.blueprint_uid()) with check (user_id = public.blueprint_uid());

-- plan_versions: via plan ownership
drop policy if exists planner_plan_versions_via_plan on public.planner_plan_versions;
create policy planner_plan_versions_via_plan on public.planner_plan_versions
  for all using (
    exists (select 1 from public.planner_plans p where p.id = plan_id and p.user_id = public.blueprint_uid())
  );

-- plan_briefs: via plan ownership
drop policy if exists planner_plan_briefs_via_plan on public.planner_plan_briefs;
create policy planner_plan_briefs_via_plan on public.planner_plan_briefs
  for all using (
    exists (select 1 from public.planner_plans p where p.id = plan_id and p.user_id = public.blueprint_uid())
  );

-- strategy_profiles: via plan ownership
drop policy if exists planner_strategy_profiles_via_plan on public.planner_strategy_profiles;
create policy planner_strategy_profiles_via_plan on public.planner_strategy_profiles
  for all using (
    exists (select 1 from public.planner_plans p where p.id = plan_id and p.user_id = public.blueprint_uid())
  );

-- content_items: via plan ownership
drop policy if exists planner_content_items_via_plan on public.planner_content_items;
create policy planner_content_items_via_plan on public.planner_content_items
  for all using (
    exists (select 1 from public.planner_plans p where p.id = plan_id and p.user_id = public.blueprint_uid())
  );

-- chat_threads: user can only access own
drop policy if exists planner_chat_threads_user_all on public.planner_chat_threads;
create policy planner_chat_threads_user_all on public.planner_chat_threads
  for all using (user_id = public.blueprint_uid()) with check (user_id = public.blueprint_uid());

-- chat_messages: via thread ownership
drop policy if exists planner_chat_messages_via_thread on public.planner_chat_messages;
create policy planner_chat_messages_via_thread on public.planner_chat_messages
  for all using (
    exists (select 1 from public.planner_chat_threads t where t.id = thread_id and t.user_id = public.blueprint_uid())
  );

-- ai_actions: via thread or plan ownership
drop policy if exists planner_ai_actions_via_thread_plan on public.planner_ai_actions;
create policy planner_ai_actions_via_thread_plan on public.planner_ai_actions
  for select using (
    (thread_id is not null and exists (select 1 from public.planner_chat_threads t where t.id = thread_id and t.user_id = public.blueprint_uid()))
    or (plan_id is not null and exists (select 1 from public.planner_plans p where p.id = plan_id and p.user_id = public.blueprint_uid()))
  );

-- ai_actions: inserts done via API (service role bypasses RLS); no client insert policy
