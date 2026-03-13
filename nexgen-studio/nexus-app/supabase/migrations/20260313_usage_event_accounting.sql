do $$
begin
  if to_regclass('public.usage_events') is null then
    raise notice 'Skipping 20260313_usage_event_accounting: public.usage_events does not exist.';
  else
    if to_regclass('public.generation_jobs') is not null then
      execute $sql$
      alter table public.usage_events
        add column if not exists generation_job_id uuid references public.generation_jobs(id) on delete set null
      $sql$;
    else
      execute $sql$
      alter table public.usage_events
        add column if not exists generation_job_id uuid
      $sql$;
      raise notice 'Added usage_events.generation_job_id without FK because public.generation_jobs is missing.';
    end if;

    if to_regclass('public.workflow_templates') is not null then
      execute $sql$
      alter table public.usage_events
        add column if not exists workflow_template_id uuid references public.workflow_templates(id) on delete set null
      $sql$;
    else
      execute $sql$
      alter table public.usage_events
        add column if not exists workflow_template_id uuid
      $sql$;
      raise notice 'Added usage_events.workflow_template_id without FK because public.workflow_templates is missing.';
    end if;

    execute $sql$
    alter table public.usage_events
      add column if not exists job_kind text,
      add column if not exists provider text,
      add column if not exists unit_type text not null default 'credits',
      add column if not exists event_key text
  $sql$;

    execute 'alter table public.usage_events drop constraint if exists usage_events_job_kind_check';
    execute $sql$
    alter table public.usage_events
      add constraint usage_events_job_kind_check
      check (job_kind is null or job_kind in ('image', 'video'))
  $sql$;

    execute 'alter table public.usage_events drop constraint if exists usage_events_unit_type_check';
    execute $sql$
    alter table public.usage_events
      add constraint usage_events_unit_type_check
      check (unit_type in ('credits', 'count'))
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.usage_events') is null then
    raise notice 'Skipping 20260313_usage_event_accounting indexes: public.usage_events does not exist.';
  else
    execute 'create unique index if not exists usage_events_event_key_idx on public.usage_events (event_key) where event_key is not null';
    execute 'create index if not exists usage_events_video_job_created_idx on public.usage_events (video_job_id, created_at desc)';
    execute 'create index if not exists usage_events_event_name_created_idx on public.usage_events (event_name, created_at desc)';
    execute 'create index if not exists usage_events_job_kind_created_idx on public.usage_events (job_kind, created_at desc)';
  end if;
end
$$;

select '20260313_usage_event_accounting.sql finished' as ok;
