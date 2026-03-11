create extension if not exists pgcrypto;

do $$ begin
  create type autopilot_plan_status as enum ('DRAFT', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELED');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type autopilot_item_status as enum ('PENDING', 'QUEUED', 'GENERATING', 'READY', 'FAILED', 'SKIPPED');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type series_status as enum ('DRAFT', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'ARCHIVED');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type series_episode_status as enum ('PENDING', 'QUEUED', 'GENERATING', 'READY', 'FAILED', 'SKIPPED');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.autopilot_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.blueprint_users(id) on delete cascade,
  organization_id uuid not null,
  workspace_id uuid references public.workspaces_v2(id) on delete set null,
  influencer_id uuid not null references public.influencers(id) on delete restrict,
  niche text not null,
  brand_style text not null,
  total_days int not null default 30 check (total_days > 0 and total_days <= 365),
  status autopilot_plan_status not null default 'QUEUED',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autopilot_plans_org_workspace_idx
on public.autopilot_plans (organization_id, workspace_id, created_at desc);

create index if not exists autopilot_plans_user_status_created_idx
on public.autopilot_plans (user_id, status, created_at desc);

drop trigger if exists trg_autopilot_plans_updated_at on public.autopilot_plans;
create trigger trg_autopilot_plans_updated_at
before update on public.autopilot_plans
for each row execute function public.blueprint_set_updated_at();

create table if not exists public.autopilot_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.autopilot_plans(id) on delete cascade,
  day_index int not null check (day_index > 0 and day_index <= 365),
  status autopilot_item_status not null default 'PENDING',
  title text,
  prompt text,
  scheduled_for timestamptz,
  content_plan_id uuid,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  generated_asset_id uuid references public.generated_assets(id) on delete set null,
  queue_job_id text,
  progress_json jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, day_index)
);

create index if not exists autopilot_plan_items_plan_day_idx
on public.autopilot_plan_items (plan_id, day_index);

create index if not exists autopilot_plan_items_status_idx
on public.autopilot_plan_items (status, scheduled_for, created_at);

drop trigger if exists trg_autopilot_plan_items_updated_at on public.autopilot_plan_items;
create trigger trg_autopilot_plan_items_updated_at
before update on public.autopilot_plan_items
for each row execute function public.blueprint_set_updated_at();

create table if not exists public.series_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.blueprint_users(id) on delete cascade,
  organization_id uuid not null,
  workspace_id uuid references public.workspaces_v2(id) on delete set null,
  influencer_id uuid not null references public.influencers(id) on delete restrict,
  title text not null,
  theme text not null,
  episode_count int not null default 1 check (episode_count > 0 and episode_count <= 500),
  status series_status not null default 'QUEUED',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists series_projects_org_workspace_idx
on public.series_projects (organization_id, workspace_id, created_at desc);

create index if not exists series_projects_user_status_created_idx
on public.series_projects (user_id, status, created_at desc);

drop trigger if exists trg_series_projects_updated_at on public.series_projects;
create trigger trg_series_projects_updated_at
before update on public.series_projects
for each row execute function public.blueprint_set_updated_at();

create table if not exists public.series_episodes (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series_projects(id) on delete cascade,
  episode_index int not null check (episode_index > 0 and episode_index <= 500),
  status series_episode_status not null default 'PENDING',
  title text,
  prompt text,
  content_plan_id uuid,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  generated_asset_id uuid references public.generated_assets(id) on delete set null,
  queue_job_id text,
  progress_json jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (series_id, episode_index)
);

create index if not exists series_episodes_series_episode_idx
on public.series_episodes (series_id, episode_index);

create index if not exists series_episodes_status_created_idx
on public.series_episodes (status, created_at);

drop trigger if exists trg_series_episodes_updated_at on public.series_episodes;
create trigger trg_series_episodes_updated_at
before update on public.series_episodes
for each row execute function public.blueprint_set_updated_at();

create or replace view public.v_agency_workspace_metrics as
with workspace_creators as (
  select
    w.id as workspace_id,
    w.org_id,
    c.id as creator_id,
    c.legacy_creator_id
  from public.workspaces_v2 w
  left join public.creators_v2 c on c.workspace_id = w.id and c.org_id = w.org_id
),
posts_by_workspace as (
  select wc.workspace_id, count(*)::bigint as total_posts
  from workspace_creators wc
  join public.posts p on p.org_id = wc.org_id and p.influencer_id::text = wc.legacy_creator_id
  group by wc.workspace_id
),
assets_by_workspace as (
  select wc.workspace_id, count(*)::bigint as total_generated_assets
  from workspace_creators wc
  join public.generated_assets ga
    on ga.organization_id = wc.org_id and ga.influencer_id::text = wc.legacy_creator_id
  group by wc.workspace_id
),
engagement_by_workspace as (
  select p.workspace_id, coalesce(sum(pf.engagement), 0)::bigint as engagement_total
  from public.performance_v2 pf
  join public.workspaces_v2 p on p.id = pf.workspace_id
  group by p.workspace_id
),
plan_by_workspace as (
  select
    ap.workspace_id,
    count(*)::bigint as total_plans,
    sum(case when ap.status = 'COMPLETED' then 1 else 0 end)::bigint as completed_plans
  from public.autopilot_plans ap
  group by ap.workspace_id
)
select
  w.id as workspace_id,
  w.org_id,
  w.name as workspace_name,
  coalesce(pb.total_posts, 0)::bigint as total_posts,
  coalesce(ab.total_generated_assets, 0)::bigint as total_generated_assets,
  coalesce(eb.engagement_total, 0)::bigint as engagement_total,
  0::numeric as engagement_rate,
  coalesce(pl.total_plans, 0)::bigint as plan_count,
  coalesce(pl.completed_plans, 0)::bigint as plan_completed_count
from public.workspaces_v2 w
left join posts_by_workspace pb on pb.workspace_id = w.id
left join assets_by_workspace ab on ab.workspace_id = w.id
left join engagement_by_workspace eb on eb.workspace_id = w.id
left join plan_by_workspace pl on pl.workspace_id = w.id;

create or replace view public.v_agency_creator_metrics as
with plans as (
  select
    ap.influencer_id,
    ap.organization_id,
    count(*)::bigint as total_plans,
    sum(case when ap.status = 'COMPLETED' then 1 else 0 end)::bigint as completed_plans
  from public.autopilot_plans ap
  group by ap.organization_id, ap.influencer_id
),
assets as (
  select
    ga.organization_id,
    ga.influencer_id,
    count(*)::bigint as total_generated_assets
  from public.generated_assets ga
  group by ga.organization_id, ga.influencer_id
),
posts as (
  select
    p.org_id as organization_id,
    p.influencer_id,
    count(*)::bigint as total_posts
  from public.posts p
  group by p.org_id, p.influencer_id
)
select
  c.id as creator_id,
  c.workspace_id,
  c.org_id as organization_id,
  c.name as creator_name,
  coalesce(po.total_posts, 0)::bigint as total_posts,
  coalesce(a.total_generated_assets, 0)::bigint as total_generated_assets,
  0::bigint as engagement_total,
  coalesce(pl.total_plans, 0)::bigint as plan_count,
  coalesce(pl.completed_plans, 0)::bigint as plan_completed_count
from public.creators_v2 c
left join posts po on po.organization_id = c.org_id and po.influencer_id::text = c.legacy_creator_id
left join assets a on a.organization_id = c.org_id and a.influencer_id::text = c.legacy_creator_id
left join plans pl on pl.organization_id = c.org_id and pl.influencer_id::text = c.legacy_creator_id;

create or replace view public.v_agency_performance_timeseries as
select
  pf.workspace_id,
  date_trunc('day', pf.recorded_at) as day,
  sum(pf.views)::bigint as views,
  sum(pf.engagement)::bigint as engagement,
  sum(pf.revenue)::numeric as revenue,
  count(*)::bigint as samples
from public.performance_v2 pf
group by pf.workspace_id, date_trunc('day', pf.recorded_at)
order by day desc;

alter table public.autopilot_plans enable row level security;
alter table public.autopilot_plan_items enable row level security;
alter table public.series_projects enable row level security;
alter table public.series_episodes enable row level security;

drop policy if exists "autopilot_plans_owner_crud" on public.autopilot_plans;
create policy "autopilot_plans_owner_crud"
on public.autopilot_plans
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "autopilot_plan_items_parent_owner_crud" on public.autopilot_plan_items;
create policy "autopilot_plan_items_parent_owner_crud"
on public.autopilot_plan_items
for all
using (
  exists (
    select 1
    from public.autopilot_plans p
    where p.id = autopilot_plan_items.plan_id
      and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.autopilot_plans p
    where p.id = autopilot_plan_items.plan_id
      and p.user_id = auth.uid()
  )
);

drop policy if exists "series_projects_owner_crud" on public.series_projects;
create policy "series_projects_owner_crud"
on public.series_projects
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "series_episodes_parent_owner_crud" on public.series_episodes;
create policy "series_episodes_parent_owner_crud"
on public.series_episodes
for all
using (
  exists (
    select 1
    from public.series_projects s
    where s.id = series_episodes.series_id
      and s.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.series_projects s
    where s.id = series_episodes.series_id
      and s.user_id = auth.uid()
  )
);

select '0007_ai_influencer_os.sql finished' as ok;
