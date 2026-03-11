create extension if not exists pgcrypto;

-- Ensure trigger function exists (run 20260305 or 0001 first for public.models / credit_ledger)
create or replace function public.blueprint_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create table if not exists public.model_gpu_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  model_id uuid not null references public.models(id) on delete cascade,
  status text not null default 'QUEUED',
  queue_job_id text,
  reserved_credits int not null check (reserved_credits >= 0),
  actual_credits int,
  runtime_seconds int,
  error text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists model_gpu_jobs_user_created_idx
on public.model_gpu_jobs (user_id, created_at desc);

create index if not exists model_gpu_jobs_status_created_idx
on public.model_gpu_jobs (status, created_at desc);

drop trigger if exists trg_model_gpu_jobs_updated_at on public.model_gpu_jobs;
create trigger trg_model_gpu_jobs_updated_at
before update on public.model_gpu_jobs
for each row execute function public.blueprint_set_updated_at();

alter table public.model_gpu_jobs enable row level security;

drop policy if exists "model_gpu_jobs_owner_crud" on public.model_gpu_jobs;
create policy "model_gpu_jobs_owner_crud"
on public.model_gpu_jobs
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.reserve_blueprint_credits(
  p_user_id uuid,
  p_amount int,
  p_ref_type text,
  p_ref_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount int := greatest(coalesce(p_amount, 0), 0);
  v_balance int;
begin
  if v_amount <= 0 then
    return jsonb_build_object('reserved', false, 'balance_after', null, 'reason', 'invalid_amount');
  end if;

  perform pg_advisory_xact_lock(hashtext(coalesce(p_user_id::text, '')));

  select coalesce(sum(delta), 0)::int
  into v_balance
  from public.credit_ledger
  where user_id = p_user_id;

  if v_balance < v_amount then
    raise exception 'Insufficient credits';
  end if;

  insert into public.credit_ledger (user_id, delta, reason, ref_type, ref_id)
  values (p_user_id, -v_amount, 'GPU_RESERVE', p_ref_type, p_ref_id);

  return jsonb_build_object('reserved', true, 'balance_after', v_balance - v_amount);
end;
$$;

grant execute on function public.reserve_blueprint_credits(uuid, int, text, text) to authenticated, anon;

create or replace function public.finalize_blueprint_credits(
  p_user_id uuid,
  p_reserved_amount int,
  p_actual_amount int,
  p_ref_type text,
  p_ref_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserved int := greatest(coalesce(p_reserved_amount, 0), 0);
  v_actual int := greatest(coalesce(p_actual_amount, 0), 0);
  v_delta int := v_reserved - v_actual;
begin
  perform pg_advisory_xact_lock(hashtext(coalesce(p_user_id::text, '')));

  if v_delta > 0 then
    insert into public.credit_ledger (user_id, delta, reason, ref_type, ref_id)
    values (p_user_id, v_delta, 'GPU_RELEASE_UNUSED', p_ref_type, p_ref_id);
  elsif v_delta < 0 then
    insert into public.credit_ledger (user_id, delta, reason, ref_type, ref_id)
    values (p_user_id, v_delta, 'GPU_FINALIZE_OVERAGE', p_ref_type, p_ref_id);
  end if;

  return jsonb_build_object('delta_applied', v_delta);
end;
$$;

grant execute on function public.finalize_blueprint_credits(uuid, int, int, text, text) to authenticated, anon;

select '20260306_billing_gpu_jobs.sql finished' as ok;
