do $$
begin
  if to_regclass('public.video_jobs') is null then
    raise notice 'Skipping 20260313_video_job_cancellation_and_provider_codes: public.video_jobs does not exist.';
  else
    execute 'alter table public.video_jobs drop constraint if exists video_jobs_status_check';
    execute $sql$
    alter table public.video_jobs
      add constraint video_jobs_status_check
      check (
        status in (
          'queued',
          'planning',
          'generating_assets',
          'rendering',
          'uploading',
          'completed',
          'failed',
          'cancelled'
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
          'unknown_error',
          'provider_cancelled',
          'provider_rate_limited',
          'provider_unavailable',
          'provider_auth_failed',
          'provider_invalid_request',
          'provider_timeout',
          'upstream_job_missing',
          'upstream_job_terminal_failed',
          'upstream_asset_missing',
          'upstream_result_invalid',
          'cancellation_requested',
          'cancellation_completed'
        )
      )
    $sql$;
  end if;
end
$$;

select '20260313_video_job_cancellation_and_provider_codes.sql finished' as ok;
