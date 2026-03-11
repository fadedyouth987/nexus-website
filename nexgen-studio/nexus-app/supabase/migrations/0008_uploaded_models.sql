create extension if not exists pgcrypto;

create table if not exists public.uploaded_models (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid,
  workspace_id uuid references public.workspaces_v2(id) on delete set null,
  model_name text not null,
  model_type text not null check (model_type in ('checkpoint', 'lora', 'vae')),
  description text,
  original_filename text not null,
  file_ext text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  mime_type text,
  storage_bucket text not null default 'models',
  storage_path text not null unique,
  validation_status text not null default 'PENDING',
  validation_message text,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists uploaded_models_user_created_idx
on public.uploaded_models (user_id, created_at desc);

create index if not exists uploaded_models_workspace_idx
on public.uploaded_models (workspace_id, model_type, created_at desc);

drop trigger if exists trg_uploaded_models_updated_at on public.uploaded_models;
create trigger trg_uploaded_models_updated_at
before update on public.uploaded_models
for each row execute function public.blueprint_set_updated_at();

alter table public.uploaded_models enable row level security;

drop policy if exists "uploaded_models_owner_crud" on public.uploaded_models;
create policy "uploaded_models_owner_crud"
on public.uploaded_models
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

select '0008_uploaded_models.sql finished' as ok;
