do $$
begin
  if to_regclass('public.video_jobs') is null then
    raise notice 'Skipping 20260313_video_job_hardening: public.video_jobs does not exist.';
  else
    execute $sql$
    alter table public.video_jobs
      add column if not exists started_at timestamptz,
      add column if not exists completed_at timestamptz,
      add column if not exists failed_at timestamptz,
      add column if not exists last_heartbeat_at timestamptz,
      add column if not exists retry_count int not null default 0,
      add column if not exists failure_stage text,
      add column if not exists failure_code text
  $sql$;

    execute 'alter table public.video_jobs drop constraint if exists video_jobs_failure_stage_check';
    execute $sql$
    alter table public.video_jobs
      add constraint video_jobs_failure_stage_check
      check (
        failure_stage is null or failure_stage in (
          'planning',
          'generating_assets',
          'rendering',
          'uploading',
          'provider_sync',
          'validation',
          'unknown'
        )
      )
  $sql$;

    execute 'alter table public.video_jobs drop constraint if exists video_jobs_failure_code_check';
    execute $sql$
    alter table public.video_jobs
      add constraint video_jobs_failure_code_check
      check (
        failure_code is null or failure_code in (
          'missing_workflow_template',
          'missing_influencer',
          'missing_required_context',
          'underlying_generation_failed',
          'underlying_generation_timeout',
          'asset_persistence_failed',
          'invalid_job_state',
          'unknown_error'
        )
      )
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.video_jobs') is null then
    raise notice 'Skipping 20260313_video_job_hardening indexes: public.video_jobs does not exist.';
  else
    execute 'create index if not exists video_jobs_status_heartbeat_idx on public.video_jobs (status, last_heartbeat_at)';
    execute 'create index if not exists video_jobs_failed_at_idx on public.video_jobs (failed_at desc) where failed_at is not null';
  end if;
end
$$;

select '20260313_video_job_hardening.sql finished' as ok;
