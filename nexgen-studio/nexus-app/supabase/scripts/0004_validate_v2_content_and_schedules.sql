select 'legacy_generations' as entity, count(*)::bigint as total
from public.generations
union all
select 'legacy_assets', count(*)::bigint
from public.assets
union all
select 'legacy_posts', count(*)::bigint
from public.posts
union all
select 'content_v2_generations', count(*)::bigint
from public.content_v2
where legacy_source = 'generations'
union all
select 'content_v2_assets', count(*)::bigint
from public.content_v2
where legacy_source = 'assets'
union all
select 'content_v2_posts', count(*)::bigint
from public.content_v2
where legacy_source = 'posts'
union all
select 'schedules_v2_legacy_posts', count(*)::bigint
from public.schedules_v2
where legacy_id is not null;

select count(*)::bigint as missing_generation_rows
from public.generations generation
join public.creators_v2 creator_v2
  on creator_v2.legacy_creator_id = generation.creator_id::text
left join public.content_v2 content
  on content.legacy_source = 'generations'
 and content.legacy_id = generation.id::text
where content.id is null;

select count(*)::bigint as missing_asset_rows
from public.assets asset
join public.creators_v2 creator_v2
  on creator_v2.legacy_creator_id = asset.influencer_id::text
left join public.content_v2 content
  on content.legacy_source = 'assets'
 and content.legacy_id = asset.id::text
where content.id is null;

select count(*)::bigint as missing_post_rows
from public.posts post
join public.creators_v2 creator_v2
  on creator_v2.legacy_creator_id = post.influencer_id::text
left join public.content_v2 content
  on content.legacy_source = 'posts'
 and content.legacy_id = post.id::text
where content.id is null;

select count(*)::bigint as missing_schedule_rows
from public.posts post
left join public.schedules_v2 schedule
  on schedule.legacy_id = post.id::text
where (
  post.scheduled_at is not null
  or post.status in ('scheduled', 'published', 'failed')
)
and schedule.id is null;

select count(*)::bigint as content_creator_org_mismatch
from public.content_v2 content
join public.creators_v2 creator
  on creator.id = content.creator_id
where content.org_id <> creator.org_id
   or content.workspace_id <> creator.workspace_id;

select count(*)::bigint as schedule_content_org_mismatch
from public.schedules_v2 schedule
join public.content_v2 content
  on content.id = schedule.content_id
where schedule.org_id <> content.org_id
   or schedule.workspace_id <> content.workspace_id;
