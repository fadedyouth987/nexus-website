-- Inbox persistence + Team invites + Monetization offers MVP

create extension if not exists pgcrypto;

-- Inbox threads/messages
create table if not exists public.inbox_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  title text not null default 'Conversation',
  unread_count integer not null default 0,
  last_message_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inbox_threads_user_idx on public.inbox_threads (user_id, updated_at desc);
create index if not exists inbox_threads_account_idx on public.inbox_threads (social_account_id, updated_at desc);

drop trigger if exists trg_inbox_threads_updated_at on public.inbox_threads;
create trigger trg_inbox_threads_updated_at
  before update on public.inbox_threads
  for each row execute function public.blueprint_set_updated_at();

create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.inbox_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  direction text not null check (direction in ('incoming', 'outgoing')),
  sender_name text,
  content text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists inbox_messages_thread_idx on public.inbox_messages (thread_id, created_at);
create index if not exists inbox_messages_user_idx on public.inbox_messages (user_id, created_at desc);

-- Team invites (enterprise collaboration)
create table if not exists public.org_team_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by_user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_team_invites_org_idx on public.org_team_invites (org_id, created_at desc);
create index if not exists org_team_invites_email_idx on public.org_team_invites (email);

drop trigger if exists trg_org_team_invites_updated_at on public.org_team_invites;
create trigger trg_org_team_invites_updated_at
  before update on public.org_team_invites
  for each row execute function public.blueprint_set_updated_at();

-- Monetization offers
create table if not exists public.monetization_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid null references public.organizations(id) on delete set null,
  name text not null,
  offer_type text not null default 'paid_shoutout',
  content_rating text not null default 'sfw' check (content_rating in ('sfw', 'nsfw')),
  platform text null,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists monetization_offers_user_idx on public.monetization_offers (user_id, updated_at desc);
create index if not exists monetization_offers_org_idx on public.monetization_offers (org_id, updated_at desc);

drop trigger if exists trg_monetization_offers_updated_at on public.monetization_offers;
create trigger trg_monetization_offers_updated_at
  before update on public.monetization_offers
  for each row execute function public.blueprint_set_updated_at();

-- RLS
alter table public.inbox_threads enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.org_team_invites enable row level security;
alter table public.monetization_offers enable row level security;

drop policy if exists inbox_threads_owner_all on public.inbox_threads;
create policy inbox_threads_owner_all on public.inbox_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists inbox_messages_owner_all on public.inbox_messages;
create policy inbox_messages_owner_all on public.inbox_messages
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists monetization_offers_owner_all on public.monetization_offers;
create policy monetization_offers_owner_all on public.monetization_offers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists org_team_invites_member_select on public.org_team_invites;
create policy org_team_invites_member_select on public.org_team_invites
  for select using (
    exists (
      select 1
      from public.org_members_v2 m
      where m.org_id = org_id
        and m.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.organization_members lm
      where (
          nullif(to_jsonb(lm)->>'organization_id', '')::uuid = org_id
          or nullif(to_jsonb(lm)->>'org_id', '')::uuid = org_id
        )
        and lm.user_id = auth.uid()
    )
  );

select '20260308_inbox_team_monetization_mvp.sql finished' as ok;

