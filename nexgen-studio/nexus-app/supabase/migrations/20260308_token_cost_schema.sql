create extension if not exists pgcrypto;

create table if not exists public.token_cost_schema (
  id uuid primary key default gen_random_uuid(),
  operation text not null,
  category text not null,
  label text not null,
  tokens_per_unit int not null check (tokens_per_unit >= 0),
  unit_label text not null default 'per run',
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists token_cost_schema_op_idx
  on public.token_cost_schema (operation);

create index if not exists token_cost_schema_category_idx
  on public.token_cost_schema (category, sort_order);

drop trigger if exists trg_token_cost_schema_updated_at on public.token_cost_schema;
create trigger trg_token_cost_schema_updated_at
  before update on public.token_cost_schema
  for each row execute function public.blueprint_set_updated_at();

alter table public.token_cost_schema enable row level security;

drop policy if exists token_cost_schema_read_all on public.token_cost_schema;
create policy token_cost_schema_read_all on public.token_cost_schema
  for select using (true);

insert into public.token_cost_schema (operation, category, label, tokens_per_unit, unit_label, description, sort_order) values
  ('image_generation',   'generation', 'Image generation',        8,  'per image',   'SDXL / Flux image generation via ComfyUI',                  10),
  ('video_generation',   'generation', 'Video generation',       45,  'per clip',    'Short-form video generation pipeline',                      20),
  ('upscale',            'edit',       'Upscale (2x-8x)',         6,  'per asset',   'Super-resolution upscaling',                                30),
  ('face_restore',       'edit',       'Face restore',            3,  'per asset',   'Face correction and clarity restoration',                   31),
  ('face_swap',          'edit',       'Face swap',               3,  'per asset',   'Swap face from reference image',                            32),
  ('expression',         'edit',       'Expression change',       3,  'per asset',   'Adjust facial expression and mood',                         33),
  ('bg_remove',          'edit',       'Background remove',       3,  'per asset',   'Automatic background removal',                              34),
  ('bg_replace',         'edit',       'Background replace',      3,  'per asset',   'Replace background with preset or custom',                  35),
  ('denoise',            'edit',       'Noise reduction',         3,  'per asset',   'Reduce noise and grain from image',                         36),
  ('sharpen',            'edit',       'Sharpen / detail',        3,  'per asset',   'Enhance sharpness and detail',                              37),
  ('color_grade',        'edit',       'Color grading',           3,  'per asset',   'Adjust color, tone, and look',                              38),
  ('video_face_swap',    'edit',       'Video face swap',        12,  'per clip',    'Consistent face replacement across video frames',            40),
  ('video_bg',           'edit',       'Video background',       10,  'per clip',    'Replace or remove video background',                        41),
  ('stabilize',          'edit',       'Motion stabilize',        8,  'per clip',    'Stabilize shaky video footage',                             42),
  ('subtitles',          'edit',       'Subtitle generation',     5,  'per clip',    'AI caption and subtitle overlay',                           43),
  ('audio_replace',      'edit',       'Audio replace',           7,  'per clip',    'Replace or add audio track to video',                       44),
  ('planner_strategy',   'automation', 'Strategy generation',     4,  'per plan',    'AI-generated 30-day content strategy',                      50),
  ('planner_calendar',   'automation', 'Calendar generation',     6,  'per plan',    'Full 30-day content calendar build',                        51),
  ('planner_optimize',   'automation', 'Prompt optimization',     3,  'per run',     'Analytics-driven strategy refinement',                      52),
  ('factory_pipeline',   'automation', 'Factory pipeline',       15,  'per run',     'Full influencer factory: persona + plan + calendar + offer', 53),
  ('social_publish',     'publishing', 'Social publish',          1,  'per post',    'Dispatch a post to a connected social platform',             60),
  ('social_retry',       'publishing', 'Publish retry',           0,  'per retry',   'Retry a failed publish (no additional cost)',                61),
  ('model_validation',   'model',      'Model GPU job',         242,  'per GPU-hr',  'Custom model validation on A100 GPU',                       70),
  ('topup_pack',         'billing',    'Token top-up pack',       0,  'per pack',    '100 tokens for $5 (add-on purchase)',                       80)
on conflict (operation) do update set
  category = excluded.category,
  label = excluded.label,
  tokens_per_unit = excluded.tokens_per_unit,
  unit_label = excluded.unit_label,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

create table if not exists public.token_tier_allowances (
  id uuid primary key default gen_random_uuid(),
  tier_id text not null unique,
  tier_label text not null,
  monthly_tokens int not null check (monthly_tokens >= 0),
  monthly_price_usd int not null check (monthly_price_usd >= 0),
  annual_price_usd int not null check (annual_price_usd >= 0),
  storage_gb int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_token_tier_allowances_updated_at on public.token_tier_allowances;
create trigger trg_token_tier_allowances_updated_at
  before update on public.token_tier_allowances
  for each row execute function public.blueprint_set_updated_at();

alter table public.token_tier_allowances enable row level security;

drop policy if exists token_tier_allowances_read_all on public.token_tier_allowances;
create policy token_tier_allowances_read_all on public.token_tier_allowances
  for select using (true);

insert into public.token_tier_allowances (tier_id, tier_label, monthly_tokens, monthly_price_usd, annual_price_usd, storage_gb) values
  ('tier1',      'Tier 1',      600,    49,   490,   100),
  ('tier2',      'Tier 2',     2000,   129,  1290,   400),
  ('tier3',      'Tier 3',     7000,   399,  3990,  1500),
  ('enterprise', 'Enterprise', 20000,  999,  9990,  5000)
on conflict (tier_id) do update set
  tier_label = excluded.tier_label,
  monthly_tokens = excluded.monthly_tokens,
  monthly_price_usd = excluded.monthly_price_usd,
  annual_price_usd = excluded.annual_price_usd,
  storage_gb = excluded.storage_gb;

select '20260308_token_cost_schema.sql finished' as ok;
