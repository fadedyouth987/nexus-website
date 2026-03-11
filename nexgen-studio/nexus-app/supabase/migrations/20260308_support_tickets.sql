create extension if not exists pgcrypto;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  email text not null,
  subject text not null,
  category text not null default 'general',
  message text not null,
  path text null,
  severity text not null default 'normal' check (severity in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_tickets_created_idx on public.support_tickets (created_at desc);
create index if not exists support_tickets_email_idx on public.support_tickets (email);
create index if not exists support_tickets_user_idx on public.support_tickets (user_id);

drop trigger if exists trg_support_tickets_updated_at on public.support_tickets;
create trigger trg_support_tickets_updated_at
  before update on public.support_tickets
  for each row execute function public.blueprint_set_updated_at();

alter table public.support_tickets enable row level security;

drop policy if exists support_tickets_owner_select on public.support_tickets;
create policy support_tickets_owner_select on public.support_tickets
  for select using (auth.uid() = user_id);

drop policy if exists support_tickets_owner_insert on public.support_tickets;
create policy support_tickets_owner_insert on public.support_tickets
  for insert with check (auth.uid() = user_id or user_id is null);

select '20260308_support_tickets.sql finished' as ok;

