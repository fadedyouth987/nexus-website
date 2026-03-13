create extension if not exists pgcrypto;

create or replace function public.saas_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.user_is_org_member(target_org uuid)
returns boolean
language plpgsql
stable
as $$
declare
  is_member boolean := false;
begin
  if to_regclass('public.org_members_v2') is not null then
    execute $sql$
      select exists (
        select 1
        from public.org_members_v2 om
        where om.org_id = $1
          and om.user_id = auth.uid()
      )
    $sql$
    into is_member
    using target_org;

    if is_member then
      return true;
    end if;
  end if;

  if to_regclass('public.organization_members') is not null then
    execute $sql$
      select exists (
        select 1
        from public.organization_members om
        where om.organization_id = $1
          and om.user_id = auth.uid()
      )
    $sql$
    into is_member
    using target_org;
  end if;

  return coalesce(is_member, false);
end;
$$;

do $$
begin
  if to_regclass('public.organizations') is null then
    raise notice 'Skipping 20260313_saas_foundation: public.organizations does not exist.';
  elsif to_regclass('auth.users') is null then
    raise notice 'Skipping 20260313_saas_foundation: auth.users does not exist.';
  else
    execute $sql$
    create table if not exists public.projects (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references public.organizations(id) on delete cascade,
      name text not null,
      description text,
      objective text,
      status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
      created_by uuid not null references auth.users(id) on delete restrict,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  $sql$;

    execute $sql$
    create table if not exists public.brand_kits (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references public.organizations(id) on delete cascade,
      project_id uuid references public.projects(id) on delete set null,
      name text not null,
      tone text,
      palette jsonb not null default '[]'::jsonb,
      typography jsonb not null default '[]'::jsonb,
      voice_guidelines text,
      created_by uuid not null references auth.users(id) on delete restrict,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  $sql$;

    execute $sql$
    create table if not exists public.campaigns (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references public.organizations(id) on delete cascade,
      project_id uuid references public.projects(id) on delete set null,
      brand_kit_id uuid references public.brand_kits(id) on delete set null,
      name text not null,
      brief text not null,
      channel text,
      objective text,
      status text not null default 'draft' check (status in ('draft', 'ready', 'running', 'completed', 'archived')),
      created_by uuid not null references auth.users(id) on delete restrict,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  $sql$;

    if to_regclass('public.generation_jobs') is not null then
      execute $sql$
      create table if not exists public.video_jobs (
        id uuid primary key default gen_random_uuid(),
        org_id uuid not null references public.organizations(id) on delete cascade,
        project_id uuid references public.projects(id) on delete set null,
        campaign_id uuid references public.campaigns(id) on delete set null,
        brand_kit_id uuid references public.brand_kits(id) on delete set null,
        source_generation_job_id uuid references public.generation_jobs(id) on delete set null,
        title text not null,
        brief text not null,
        script text,
        provider text not null default 'comfyui',
        provider_job_id text,
        status text not null default 'queued' check (status in ('queued', 'planning', 'generating_assets', 'rendering', 'uploading', 'completed', 'failed')),
        progress int not null default 0 check (progress >= 0 and progress <= 100),
        error_message text,
        metadata jsonb not null default '{}'::jsonb,
        created_by uuid not null references auth.users(id) on delete restrict,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
      $sql$;
    else
      raise notice 'Skipping source_generation_job_id FK because public.generation_jobs does not exist.';
      execute $sql$
      create table if not exists public.video_jobs (
        id uuid primary key default gen_random_uuid(),
        org_id uuid not null references public.organizations(id) on delete cascade,
        project_id uuid references public.projects(id) on delete set null,
        campaign_id uuid references public.campaigns(id) on delete set null,
        brand_kit_id uuid references public.brand_kits(id) on delete set null,
        source_generation_job_id uuid,
        title text not null,
        brief text not null,
        script text,
        provider text not null default 'comfyui',
        provider_job_id text,
        status text not null default 'queued' check (status in ('queued', 'planning', 'generating_assets', 'rendering', 'uploading', 'completed', 'failed')),
        progress int not null default 0 check (progress >= 0 and progress <= 100),
        error_message text,
        metadata jsonb not null default '{}'::jsonb,
        created_by uuid not null references auth.users(id) on delete restrict,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
      $sql$;
    end if;

    execute $sql$
    create table if not exists public.video_scenes (
      id uuid primary key default gen_random_uuid(),
      video_job_id uuid not null references public.video_jobs(id) on delete cascade,
      sequence_index int not null,
      prompt text,
      shot_type text,
      duration_seconds numeric(8,2),
      status text not null default 'queued' check (status in ('queued', 'planning', 'generating_assets', 'rendering', 'uploading', 'completed', 'failed')),
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (video_job_id, sequence_index)
    )
  $sql$;

    execute $sql$
    create table if not exists public.voiceovers (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references public.organizations(id) on delete cascade,
      video_job_id uuid references public.video_jobs(id) on delete cascade,
      provider text not null,
      voice_key text not null,
      script text not null,
      status text not null default 'queued' check (status in ('queued', 'planning', 'generating_assets', 'rendering', 'uploading', 'completed', 'failed')),
      asset_url text,
      created_by uuid not null references auth.users(id) on delete restrict,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  $sql$;

    if to_regclass('public.generated_assets') is not null then
      execute $sql$
      create table if not exists public.renders (
        id uuid primary key default gen_random_uuid(),
        org_id uuid not null references public.organizations(id) on delete cascade,
        video_job_id uuid references public.video_jobs(id) on delete cascade,
        generated_asset_id uuid references public.generated_assets(id) on delete set null,
        provider text not null,
        format text,
        duration_seconds numeric(8,2),
        output_url text,
        status text not null default 'queued' check (status in ('queued', 'planning', 'generating_assets', 'rendering', 'uploading', 'completed', 'failed')),
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
      $sql$;
    else
      raise notice 'Skipping generated_asset_id FK because public.generated_assets does not exist.';
      execute $sql$
      create table if not exists public.renders (
        id uuid primary key default gen_random_uuid(),
        org_id uuid not null references public.organizations(id) on delete cascade,
        video_job_id uuid references public.video_jobs(id) on delete cascade,
        generated_asset_id uuid,
        provider text not null,
        format text,
        duration_seconds numeric(8,2),
        output_url text,
        status text not null default 'queued' check (status in ('queued', 'planning', 'generating_assets', 'rendering', 'uploading', 'completed', 'failed')),
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
      $sql$;
    end if;

    execute $sql$
    create table if not exists public.usage_events (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references public.organizations(id) on delete cascade,
      user_id uuid references auth.users(id) on delete set null,
      project_id uuid references public.projects(id) on delete set null,
      campaign_id uuid references public.campaigns(id) on delete set null,
      video_job_id uuid references public.video_jobs(id) on delete set null,
      event_name text not null,
      units numeric not null default 0,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  $sql$;

    execute $sql$
    create table if not exists public.subscriptions (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references public.organizations(id) on delete cascade,
      provider text not null default 'stripe',
      provider_customer_id text,
      provider_subscription_id text,
      plan_key text not null,
      status text not null default 'trialing',
      renews_at timestamptz,
      cancel_at timestamptz,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  $sql$;

    execute $sql$
    create table if not exists public.scheduled_content_runs (
      id uuid primary key default gen_random_uuid(),
      org_id uuid not null references public.organizations(id) on delete cascade,
      project_id uuid references public.projects(id) on delete cascade,
      campaign_id uuid references public.campaigns(id) on delete set null,
      schedule_key text not null,
      frequency text not null,
      status text not null default 'draft' check (status in ('draft', 'scheduled', 'running', 'paused', 'failed', 'completed')),
      next_run_at timestamptz,
      last_run_at timestamptz,
      metadata jsonb not null default '{}'::jsonb,
      created_by uuid not null references auth.users(id) on delete restrict,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.projects') is not null then
    execute 'create index if not exists projects_org_created_idx on public.projects (org_id, created_at desc)';
  end if;

  if to_regclass('public.brand_kits') is not null then
    execute 'create index if not exists brand_kits_org_updated_idx on public.brand_kits (org_id, updated_at desc)';
  end if;

  if to_regclass('public.campaigns') is not null then
    execute 'create index if not exists campaigns_org_updated_idx on public.campaigns (org_id, updated_at desc)';
  end if;

  if to_regclass('public.video_jobs') is not null then
    execute 'create index if not exists video_jobs_org_created_idx on public.video_jobs (org_id, created_at desc)';
    execute 'create index if not exists video_jobs_status_created_idx on public.video_jobs (status, created_at desc)';
    execute 'create index if not exists video_jobs_generation_idx on public.video_jobs (source_generation_job_id)';
  end if;

  if to_regclass('public.usage_events') is not null then
    execute 'create index if not exists usage_events_org_created_idx on public.usage_events (org_id, created_at desc)';
  end if;

  if to_regclass('public.scheduled_content_runs') is not null then
    execute 'create index if not exists scheduled_content_runs_org_next_run_idx on public.scheduled_content_runs (org_id, next_run_at)';
  end if;
end
$$;

do $$
begin
  if to_regclass('public.projects') is not null then
    execute 'drop trigger if exists trg_projects_updated_at on public.projects';
    execute 'create trigger trg_projects_updated_at before update on public.projects for each row execute function public.saas_set_updated_at()';
    execute 'alter table public.projects enable row level security';
    execute 'drop policy if exists "projects_org_member_crud" on public.projects';
    execute 'create policy "projects_org_member_crud" on public.projects for all using (public.user_is_org_member(org_id)) with check (public.user_is_org_member(org_id))';
  end if;

  if to_regclass('public.brand_kits') is not null then
    execute 'drop trigger if exists trg_brand_kits_updated_at on public.brand_kits';
    execute 'create trigger trg_brand_kits_updated_at before update on public.brand_kits for each row execute function public.saas_set_updated_at()';
    execute 'alter table public.brand_kits enable row level security';
    execute 'drop policy if exists "brand_kits_org_member_crud" on public.brand_kits';
    execute 'create policy "brand_kits_org_member_crud" on public.brand_kits for all using (public.user_is_org_member(org_id)) with check (public.user_is_org_member(org_id))';
  end if;

  if to_regclass('public.campaigns') is not null then
    execute 'drop trigger if exists trg_campaigns_updated_at on public.campaigns';
    execute 'create trigger trg_campaigns_updated_at before update on public.campaigns for each row execute function public.saas_set_updated_at()';
    execute 'alter table public.campaigns enable row level security';
    execute 'drop policy if exists "campaigns_org_member_crud" on public.campaigns';
    execute 'create policy "campaigns_org_member_crud" on public.campaigns for all using (public.user_is_org_member(org_id)) with check (public.user_is_org_member(org_id))';
  end if;

  if to_regclass('public.video_jobs') is not null then
    execute 'drop trigger if exists trg_video_jobs_updated_at on public.video_jobs';
    execute 'create trigger trg_video_jobs_updated_at before update on public.video_jobs for each row execute function public.saas_set_updated_at()';
    execute 'alter table public.video_jobs enable row level security';
    execute 'drop policy if exists "video_jobs_org_member_crud" on public.video_jobs';
    execute 'create policy "video_jobs_org_member_crud" on public.video_jobs for all using (public.user_is_org_member(org_id)) with check (public.user_is_org_member(org_id))';
  end if;

  if to_regclass('public.video_scenes') is not null then
    execute 'drop trigger if exists trg_video_scenes_updated_at on public.video_scenes';
    execute 'create trigger trg_video_scenes_updated_at before update on public.video_scenes for each row execute function public.saas_set_updated_at()';
    execute 'alter table public.video_scenes enable row level security';
    execute 'drop policy if exists "video_scenes_org_member_crud" on public.video_scenes';
    execute $sql$
      create policy "video_scenes_org_member_crud" on public.video_scenes
      for all using (
        exists (
          select 1 from public.video_jobs vj
          where vj.id = video_scenes.video_job_id
            and public.user_is_org_member(vj.org_id)
        )
      )
      with check (
        exists (
          select 1 from public.video_jobs vj
          where vj.id = video_scenes.video_job_id
            and public.user_is_org_member(vj.org_id)
        )
      )
    $sql$;
  end if;

  if to_regclass('public.voiceovers') is not null then
    execute 'drop trigger if exists trg_voiceovers_updated_at on public.voiceovers';
    execute 'create trigger trg_voiceovers_updated_at before update on public.voiceovers for each row execute function public.saas_set_updated_at()';
    execute 'alter table public.voiceovers enable row level security';
    execute 'drop policy if exists "voiceovers_org_member_crud" on public.voiceovers';
    execute 'create policy "voiceovers_org_member_crud" on public.voiceovers for all using (public.user_is_org_member(org_id)) with check (public.user_is_org_member(org_id))';
  end if;

  if to_regclass('public.renders') is not null then
    execute 'drop trigger if exists trg_renders_updated_at on public.renders';
    execute 'create trigger trg_renders_updated_at before update on public.renders for each row execute function public.saas_set_updated_at()';
    execute 'alter table public.renders enable row level security';
    execute 'drop policy if exists "renders_org_member_crud" on public.renders';
    execute 'create policy "renders_org_member_crud" on public.renders for all using (public.user_is_org_member(org_id)) with check (public.user_is_org_member(org_id))';
  end if;

  if to_regclass('public.usage_events') is not null then
    execute 'alter table public.usage_events enable row level security';
    execute 'drop policy if exists "usage_events_org_member_select" on public.usage_events';
    execute 'create policy "usage_events_org_member_select" on public.usage_events for select using (public.user_is_org_member(org_id))';
  end if;

  if to_regclass('public.subscriptions') is not null then
    execute 'drop trigger if exists trg_subscriptions_updated_at on public.subscriptions';
    execute 'create trigger trg_subscriptions_updated_at before update on public.subscriptions for each row execute function public.saas_set_updated_at()';
    execute 'alter table public.subscriptions enable row level security';
    execute 'drop policy if exists "subscriptions_org_member_select" on public.subscriptions';
    execute 'create policy "subscriptions_org_member_select" on public.subscriptions for select using (public.user_is_org_member(org_id))';
  end if;

  if to_regclass('public.scheduled_content_runs') is not null then
    execute 'drop trigger if exists trg_scheduled_content_runs_updated_at on public.scheduled_content_runs';
    execute 'create trigger trg_scheduled_content_runs_updated_at before update on public.scheduled_content_runs for each row execute function public.saas_set_updated_at()';
    execute 'alter table public.scheduled_content_runs enable row level security';
    execute 'drop policy if exists "scheduled_content_runs_org_member_crud" on public.scheduled_content_runs';
    execute 'create policy "scheduled_content_runs_org_member_crud" on public.scheduled_content_runs for all using (public.user_is_org_member(org_id)) with check (public.user_is_org_member(org_id))';
  end if;
end
$$;

select '20260313_saas_foundation.sql finished' as ok;
