do $$
begin
  if to_regclass('public.video_jobs') is null then
    raise notice 'Skipping 20260313_video_job_kind_support: public.video_jobs does not exist.';
  else
    execute $sql$
    alter table public.video_jobs
      add column if not exists job_kind text not null default 'video'
  $sql$;

    execute 'alter table public.video_jobs drop constraint if exists video_jobs_job_kind_check';
    execute $sql$
    alter table public.video_jobs
      add constraint video_jobs_job_kind_check
      check (job_kind in ('video', 'image'))
    $sql$;
  end if;
end
$$;

do $$
begin
  if to_regclass('public.video_jobs') is null then
    raise notice 'Skipping 20260313_video_job_kind_support indexes: public.video_jobs does not exist.';
  else
    execute 'create index if not exists video_jobs_kind_created_idx on public.video_jobs (job_kind, created_at desc)';
  end if;
end
$$;

select '20260313_video_job_kind_support.sql finished' as ok;
