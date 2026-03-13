do $$
begin
  if to_regclass('public.scheduled_content_runs') is null then
    raise notice 'Skipping 20260313_scheduled_content_automation: public.scheduled_content_runs does not exist.';
  else
    if to_regclass('public.brand_kits') is not null then
      execute $sql$
      alter table public.scheduled_content_runs
        add column if not exists brand_kit_id uuid references public.brand_kits(id) on delete set null
      $sql$;
    else
      execute 'alter table public.scheduled_content_runs add column if not exists brand_kit_id uuid';
    end if;

    if to_regclass('public.workflow_templates') is not null then
      execute $sql$
      alter table public.scheduled_content_runs
        add column if not exists workflow_template_id uuid references public.workflow_templates(id) on delete set null
      $sql$;
    else
      execute 'alter table public.scheduled_content_runs add column if not exists workflow_template_id uuid';
    end if;

    if to_regclass('public.influencers') is not null then
      execute $sql$
      alter table public.scheduled_content_runs
        add column if not exists influencer_id uuid references public.influencers(id) on delete set null
      $sql$;
    else
      execute 'alter table public.scheduled_content_runs add column if not exists influencer_id uuid';
    end if;

    execute $sql$
    alter table public.scheduled_content_runs
      add column if not exists title text,
      add column if not exists brief text,
      add column if not exists script text,
      add column if not exists provider text not null default 'comfyui',
      add column if not exists job_kind text not null default 'video',
      add column if not exists jobs_per_run integer not null default 1,
      add column if not exists day_of_week integer,
      add column if not exists time_of_day text not null default '09:00',
      add column if not exists timezone text not null default 'UTC',
      add column if not exists last_success_at timestamptz,
      add column if not exists last_failure_at timestamptz,
      add column if not exists last_error_message text
  $sql$;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'scheduled_content_runs'
        and column_name = 'schedule_key'
    ) and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'scheduled_content_runs'
        and column_name = 'metadata'
    ) then
      execute $sql$
      update public.scheduled_content_runs
      set title = coalesce(title, schedule_key),
          brief = coalesce(brief, metadata->>'brief', '')
      where title is null
         or brief is null
      $sql$;
    else
      execute $sql$
      update public.scheduled_content_runs
      set title = coalesce(title, 'Scheduled content run'),
          brief = coalesce(brief, '')
      where title is null
         or brief is null
      $sql$;
    end if;

    begin
      execute 'alter table public.scheduled_content_runs alter column title set not null';
      execute 'alter table public.scheduled_content_runs alter column brief set not null';
    exception
      when others then
        raise notice 'Could not mark scheduled_content_runs.title/brief as not null: %', sqlerrm;
    end;

    execute 'alter table public.scheduled_content_runs drop constraint if exists scheduled_content_runs_job_kind_check';
    execute $sql$
    alter table public.scheduled_content_runs
      add constraint scheduled_content_runs_job_kind_check
      check (job_kind in ('image', 'video'))
  $sql$;

    execute 'alter table public.scheduled_content_runs drop constraint if exists scheduled_content_runs_jobs_per_run_check';
    execute $sql$
    alter table public.scheduled_content_runs
      add constraint scheduled_content_runs_jobs_per_run_check
      check (jobs_per_run >= 1 and jobs_per_run <= 10)
  $sql$;

    execute 'alter table public.scheduled_content_runs drop constraint if exists scheduled_content_runs_day_of_week_check';
    execute $sql$
    alter table public.scheduled_content_runs
      add constraint scheduled_content_runs_day_of_week_check
      check (day_of_week is null or day_of_week between 0 and 6)
  $sql$;

    execute 'alter table public.scheduled_content_runs drop constraint if exists scheduled_content_runs_frequency_check';
    execute $sql$
    alter table public.scheduled_content_runs
      add constraint scheduled_content_runs_frequency_check
      check (frequency in ('daily', 'weekly'))
  $sql$;

    if to_regclass('public.organizations') is not null then
      execute $sql$
      create table if not exists public.scheduled_content_run_executions (
        id uuid primary key default gen_random_uuid(),
        scheduled_content_run_id uuid not null references public.scheduled_content_runs(id) on delete cascade,
        org_id uuid not null references public.organizations(id) on delete cascade,
        trigger_type text not null default 'recurrence',
        scheduled_for timestamptz not null,
        status text not null default 'running',
        jobs_requested integer not null default 1,
        jobs_created integer not null default 0,
        started_at timestamptz not null default now(),
        completed_at timestamptz,
        failed_at timestamptz,
        error_message text,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
      $sql$;
    else
      raise notice 'Skipping scheduled_content_run_executions creation because public.organizations does not exist.';
    end if;

    if to_regclass('public.scheduled_content_run_executions') is not null then
      execute 'alter table public.scheduled_content_run_executions drop constraint if exists scheduled_content_run_executions_trigger_type_check';
      execute $sql$
      alter table public.scheduled_content_run_executions
        add constraint scheduled_content_run_executions_trigger_type_check
        check (trigger_type in ('recurrence', 'manual'))
    $sql$;

      execute 'alter table public.scheduled_content_run_executions drop constraint if exists scheduled_content_run_executions_status_check';
      execute $sql$
      alter table public.scheduled_content_run_executions
        add constraint scheduled_content_run_executions_status_check
        check (status in ('running', 'completed', 'failed'))
      $sql$;
    end if;

    if to_regclass('public.video_jobs') is not null then
      execute 'alter table public.video_jobs add column if not exists scheduled_content_run_id uuid';
      execute 'alter table public.video_jobs add column if not exists scheduled_content_run_execution_id uuid';
    end if;

    if to_regclass('public.scheduled_content_run_executions') is not null then
      execute 'create unique index if not exists scheduled_content_run_executions_slot_idx on public.scheduled_content_run_executions (scheduled_content_run_id, scheduled_for, trigger_type)';
      execute 'create index if not exists scheduled_content_run_executions_schedule_created_idx on public.scheduled_content_run_executions (scheduled_content_run_id, created_at desc)';
      execute 'alter table public.scheduled_content_run_executions enable row level security';
      execute 'drop trigger if exists trg_scheduled_content_run_executions_updated_at on public.scheduled_content_run_executions';
      execute 'create trigger trg_scheduled_content_run_executions_updated_at before update on public.scheduled_content_run_executions for each row execute function public.saas_set_updated_at()';
      execute 'drop policy if exists "scheduled_content_run_executions_org_member_select" on public.scheduled_content_run_executions';
      execute 'create policy "scheduled_content_run_executions_org_member_select" on public.scheduled_content_run_executions for select using (public.user_is_org_member(org_id))';
      execute 'drop policy if exists "scheduled_content_run_executions_org_member_insert" on public.scheduled_content_run_executions';
      execute 'create policy "scheduled_content_run_executions_org_member_insert" on public.scheduled_content_run_executions for insert with check (public.user_is_org_member(org_id))';
    end if;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.scheduled_content_runs') is not null then
    execute 'create index if not exists scheduled_content_runs_status_next_run_idx on public.scheduled_content_runs (status, next_run_at)';
  end if;

  if to_regclass('public.video_jobs') is not null then
    execute 'create index if not exists video_jobs_scheduled_content_run_idx on public.video_jobs (scheduled_content_run_id, created_at desc)';
    execute 'create index if not exists video_jobs_scheduled_content_run_execution_idx on public.video_jobs (scheduled_content_run_execution_id)';
  end if;
end
$$;

select '20260313_scheduled_content_automation.sql finished' as ok;
