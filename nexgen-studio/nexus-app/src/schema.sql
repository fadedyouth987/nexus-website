-- 1. ORGANIZATIONS (Multi-Tenancy Root)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique, -- e.g., 'agency-name'
  custom_domain text unique, -- e.g., 'clients.agency.com'
  branding_config jsonb, -- { "logo": "url", "primary_color": "#hex" }
  subscription_tier text check (subscription_tier in ('starter', 'pro', 'enterprise')),
  stripe_customer_id text,
  sso_settings jsonb -- { "provider": "okta", "metadata_url": "..." }
);

-- 2. USERS & RBAC
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  full_name text,
  encrypted_password text, -- Managed by Auth Provider
  is_platform_admin boolean default false, -- Super Admin for YOU
  created_at timestamp default now()
);

create table organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  user_id uuid references users(id),
  role text check (role in ('owner', 'admin', 'editor', 'viewer', 'compliance')),
  mfa_enabled boolean default false
);

-- 3. INFLUENCERS (The Assets)
create table influencers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  name text not null,
  handle text,
  niche text,
  lora_model_path text,
  voice_id text,
  personality_system_prompt text,
  safety_lock boolean default true,
  is_active boolean default true
);

-- 4. CONTENT & ASSETS
create table assets (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid references influencers(id),
  org_id uuid references organizations(id),
  url text not null,
  type text check (type in ('image', 'video', 'audio')),
  c2pa_hash text,
  safety_rating text check (safety_rating in ('safe', 'suggestive', 'explicit')),
  is_archived boolean default false
);

-- 5. POSTS & SCHEDULING
create table posts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  influencer_id uuid references influencers(id),
  asset_id uuid references assets(id),
  platform text,
  caption text,
  scheduled_at timestamp,
  status text check (status in ('draft', 'pending_approval', 'scheduled', 'published', 'failed')),
  approval_chain jsonb -- { "requested_by": "user_id", "approved_by": "user_id" }
);

-- 6. CRM & GROWTH
create table fans (
  id uuid primary key default gen_random_uuid(),
  influencer_id uuid references influencers(id),
  username text,
  platform text,
  total_spend_cents integer default 0,
  vip_status boolean default false,
  last_interaction timestamp
);

-- 7. LOGGING
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),
  actor_id uuid references users(id),
  action text,
  target_resource text,
  details jsonb,
  ip_address text,
  timestamp timestamp default now()
);