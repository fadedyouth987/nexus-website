do $$ begin
  alter table public.generated_assets
  add constraint generated_assets_job_kind_variant_key
  unique (generation_job_id, kind, asset_variant);
exception when duplicate_object then null; end $$;

create index if not exists generated_assets_visibility_org_created_idx
on public.generated_assets (visibility, organization_id, created_at desc);

create index if not exists generated_assets_visibility_influencer_created_idx
on public.generated_assets (visibility, influencer_id, created_at desc);

create index if not exists generated_assets_job_idx
on public.generated_assets (generation_job_id);

create index if not exists generation_jobs_user_status_idx
on public.generation_jobs (user_id, status, created_at desc);

create index if not exists generation_jobs_org_created_idx
on public.generation_jobs (organization_id, created_at desc);

create index if not exists generation_jobs_influencer_idx
on public.generation_jobs (influencer_id, created_at desc);
