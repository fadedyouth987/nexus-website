-- Persona LLM: structured personality, lore, and voice for dual-LLM architecture.
-- Requires: public.influencers table (e.g. from 0007 or your schema).

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'influencers') then
    alter table public.influencers add column if not exists personality_json jsonb not null default '{}'::jsonb;
    alter table public.influencers add column if not exists lore_memory jsonb not null default '{}'::jsonb;
    alter table public.influencers add column if not exists voice_style text null;
    comment on column public.influencers.personality_json is 'Structured personality for Persona LLM (traits, tone, slang, do/don''t).';
    comment on column public.influencers.lore_memory is 'Backstory and persistent lore for in-character replies.';
    comment on column public.influencers.voice_style is 'Voice style description (e.g. playful, sarcastic, warm).';
  end if;
end $$;

-- Optional: engagement_logs for automation (only if influencers exists)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'influencers') then
    execute 'create table if not exists public.engagement_logs (
      id uuid primary key default gen_random_uuid(),
      influencer_id uuid not null references public.influencers(id) on delete cascade,
      platform text not null,
      thread_id text null,
      role text not null check (role in (''user'', ''influencer'', ''system'')),
      content text not null,
      metadata_json jsonb not null default ''{}''::jsonb,
      created_at timestamptz not null default now()
    )';
    execute 'create index if not exists engagement_logs_influencer_created_idx on public.engagement_logs (influencer_id, created_at desc)';
    execute 'create index if not exists engagement_logs_thread_idx on public.engagement_logs (influencer_id, platform, thread_id)';
  end if;
end $$;

select '20260306_llm_persona_fields.sql finished' as ok;
