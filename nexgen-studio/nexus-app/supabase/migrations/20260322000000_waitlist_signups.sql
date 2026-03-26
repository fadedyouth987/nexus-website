-- Public beta waitlist signups (written via service role from /api/waitlist only).
create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  content_goals text,
  source text default 'landing_beta_invite',
  created_at timestamptz not null default now(),
  constraint waitlist_signups_email_unique unique (email)
);

create index if not exists waitlist_signups_created_at_idx on public.waitlist_signups (created_at desc);

alter table public.waitlist_signups enable row level security;

-- No policies for anon/authenticated: only service role (bypasses RLS) inserts from API.

comment on table public.waitlist_signups is 'Marketing waitlist; inserts from app API with service role only.';
