begin;

with default_actor as (
  select distinct on (member.org_id)
    member.org_id,
    member.user_id
  from public.org_members_v2 member
  order by member.org_id, member.created_at asc
),
generation_rows as (
  select
    generation.id::text as legacy_id,
    creator_v2.org_id,
    creator_v2.workspace_id,
    creator_v2.id as creator_id,
    coalesce(auth_user.id, default_actor.user_id) as created_by,
    case
      when generation.status in ('completed', 'published', 'ready') then 'published'
      when generation.status in ('failed', 'error') then 'failed'
      when generation.status in ('queued', 'pending', 'in_progress', 'generating') then 'draft'
      else 'draft'
    end as status,
    jsonb_strip_nulls(
      jsonb_build_object(
        'source', 'generations',
        'prompt', generation.prompt,
        'negative_prompt', generation.negative_prompt,
        'model', generation.model,
        'parameters', coalesce(generation.parameters, '{}'::jsonb),
        'error_message', generation.error_message
      )
    ) as data,
    coalesce(generation.created_at, now()) as created_at,
    coalesce(generation.updated_at, coalesce(generation.created_at, now())) as updated_at
  from public.generations generation
  join public.creators_v2 creator_v2
    on creator_v2.legacy_creator_id = generation.creator_id::text
  left join auth.users auth_user
    on auth_user.id = generation.user_id
  left join default_actor
    on default_actor.org_id = creator_v2.org_id
  where not exists (
    select 1
    from public.content_v2 content
    where content.legacy_source = 'generations'
      and content.legacy_id = generation.id::text
  )
)
insert into public.content_v2 (
  org_id,
  workspace_id,
  creator_id,
  type,
  status,
  data,
  created_by,
  legacy_source,
  legacy_id,
  created_at,
  updated_at
)
select
  row.org_id,
  row.workspace_id,
  row.creator_id,
  'image',
  row.status,
  row.data,
  row.created_by,
  'generations',
  row.legacy_id,
  row.created_at,
  row.updated_at
from generation_rows row
where row.created_by is not null;

with default_actor as (
  select distinct on (member.org_id)
    member.org_id,
    member.user_id
  from public.org_members_v2 member
  order by member.org_id, member.created_at asc
),
asset_rows as (
  select
    asset.id::text as legacy_id,
    creator_v2.org_id,
    creator_v2.workspace_id,
    creator_v2.id as creator_id,
    default_actor.user_id as created_by,
    case
      when coalesce(asset.is_archived, false) then 'archived'
      else 'draft'
    end as status,
    case
      when lower(coalesce(asset.type, 'image')) in ('image', 'video', 'caption', 'post')
        then lower(asset.type)
      else 'image'
    end as type,
    jsonb_strip_nulls(
      jsonb_build_object(
        'source', 'assets',
        'url', asset.url,
        'c2pa_hash', asset.c2pa_hash,
        'safety_rating', asset.safety_rating
      )
    ) as data,
    coalesce(asset.created_at, now()) as created_at
  from public.assets asset
  join public.creators_v2 creator_v2
    on creator_v2.legacy_creator_id = asset.influencer_id::text
  left join default_actor
    on default_actor.org_id = creator_v2.org_id
  where not exists (
    select 1
    from public.content_v2 content
    where content.legacy_source = 'assets'
      and content.legacy_id = asset.id::text
  )
)
insert into public.content_v2 (
  org_id,
  workspace_id,
  creator_id,
  type,
  status,
  data,
  created_by,
  legacy_source,
  legacy_id,
  created_at,
  updated_at
)
select
  row.org_id,
  row.workspace_id,
  row.creator_id,
  row.type,
  row.status,
  row.data,
  row.created_by,
  'assets',
  row.legacy_id,
  row.created_at,
  row.created_at
from asset_rows row
where row.created_by is not null;

with default_actor as (
  select distinct on (member.org_id)
    member.org_id,
    member.user_id
  from public.org_members_v2 member
  order by member.org_id, member.created_at asc
),
post_rows as (
  select
    post.id::text as legacy_id,
    creator_v2.org_id,
    creator_v2.workspace_id,
    creator_v2.id as creator_id,
    default_actor.user_id as created_by,
    case
      when post.status = 'pending_approval' then 'client_review'
      when post.status = 'scheduled' then 'scheduled'
      when post.status = 'published' then 'published'
      when post.status = 'failed' then 'failed'
      else 'draft'
    end as status,
    jsonb_strip_nulls(
      jsonb_build_object(
        'source', 'posts',
        'platform', post.platform,
        'caption', post.caption,
        'asset_id', post.asset_id,
        'approval_chain', coalesce(post.approval_chain, '{}'::jsonb),
        'schedule', case
          when post.scheduled_at is not null then jsonb_build_object(
            'platform', post.platform,
            'scheduled_for', post.scheduled_at,
            'status', post.status
          )
          else null
        end
      )
    ) as data,
    coalesce(post.created_at, now()) as created_at
  from public.posts post
  join public.creators_v2 creator_v2
    on creator_v2.legacy_creator_id = post.influencer_id::text
  left join default_actor
    on default_actor.org_id = creator_v2.org_id
  where not exists (
    select 1
    from public.content_v2 content
    where content.legacy_source = 'posts'
      and content.legacy_id = post.id::text
  )
)
insert into public.content_v2 (
  org_id,
  workspace_id,
  creator_id,
  type,
  status,
  data,
  created_by,
  legacy_source,
  legacy_id,
  created_at,
  updated_at
)
select
  row.org_id,
  row.workspace_id,
  row.creator_id,
  'post',
  row.status,
  row.data,
  row.created_by,
  'posts',
  row.legacy_id,
  row.created_at,
  row.created_at
from post_rows row
where row.created_by is not null;

insert into public.schedules_v2 (
  org_id,
  workspace_id,
  content_id,
  platform,
  scheduled_for,
  status,
  error,
  legacy_post_id,
  legacy_id,
  created_at
)
select
  content.org_id,
  content.workspace_id,
  content.id as content_id,
  post.platform,
  post.scheduled_at,
  case
    when post.status = 'published' then 'published'
    when post.status = 'failed' then 'failed'
    when post.status = 'scheduled' then 'scheduled'
    when post.status = 'draft' and post.scheduled_at is not null then 'queued'
    when post.status = 'pending_approval' and post.scheduled_at is not null then 'queued'
    else 'queued'
  end as status,
  '{}'::jsonb as error,
  post.id as legacy_post_id,
  post.id::text as legacy_id,
  coalesce(post.created_at, now()) as created_at
from public.posts post
join public.content_v2 content
  on content.legacy_source = 'posts'
 and content.legacy_id = post.id::text
where not exists (
  select 1
  from public.schedules_v2 schedule
  where schedule.legacy_id = post.id::text
)
and (
  post.scheduled_at is not null
  or post.status in ('scheduled', 'published', 'failed')
);

commit;
