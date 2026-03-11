begin;

set local role authenticated;
set local row_security = on;

create temp table if not exists _rls_results (
  test_name text not null,
  status text not null,
  detail text null
);

do $$
declare
  candidate record;
  creator_id uuid;
  owner_draft_content_id uuid;
  owner_review_content_id uuid;
  editor_schedule_id uuid;
  same_org_unassigned_workspace_id uuid;
  other_org_workspace_id uuid;
  visible_rows integer;
begin
  select
    owner_member.org_id,
    owner_workspace.workspace_id,
    owner_member.user_id as owner_user_id,
    editor_member.user_id as editor_user_id,
    viewer_member.user_id as viewer_user_id
  into candidate
  from public.org_members_v2 owner_member
  join public.org_members_v2 editor_member
    on editor_member.org_id = owner_member.org_id
   and editor_member.role = 'editor'
  join public.org_members_v2 viewer_member
    on viewer_member.org_id = owner_member.org_id
   and viewer_member.role = 'viewer'
  join public.workspace_members_v2 owner_workspace
    on owner_workspace.org_id = owner_member.org_id
   and owner_workspace.user_id = owner_member.user_id
  join public.workspace_members_v2 editor_workspace
    on editor_workspace.workspace_id = owner_workspace.workspace_id
   and editor_workspace.user_id = editor_member.user_id
  join public.workspace_members_v2 viewer_workspace
    on viewer_workspace.workspace_id = owner_workspace.workspace_id
   and viewer_workspace.user_id = viewer_member.user_id
  where owner_member.role in ('owner', 'admin')
  order by owner_member.created_at asc
  limit 1;

  if candidate is null then
    insert into _rls_results (test_name, status, detail)
    values (
      'bootstrap.roles',
      'skipped',
      'No org/workspace found with owner-or-admin + editor + viewer in same workspace'
    );
    return;
  end if;

  select creator.id
  into creator_id
  from public.creators_v2 creator
  where creator.org_id = candidate.org_id
    and creator.workspace_id = candidate.workspace_id
  order by creator.created_at asc
  limit 1;

  if creator_id is null then
    insert into _rls_results (test_name, status, detail)
    values (
      'bootstrap.creator',
      'skipped',
      'No creator in candidate workspace; create at least one creators_v2 row first'
    );
    return;
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', candidate.owner_user_id::text, true);

  begin
    insert into public.content_v2 (
      org_id,
      workspace_id,
      creator_id,
      type,
      status,
      data,
      created_by
    )
    values (
      candidate.org_id,
      candidate.workspace_id,
      creator_id,
      'post',
      'draft',
      jsonb_build_object('source', 'rls_regression', 'test', 'owner_insert_content'),
      candidate.owner_user_id
    )
    returning id into owner_draft_content_id;

    insert into _rls_results (test_name, status, detail)
    values ('owner.insert_content', 'pass', null);
  exception when others then
    insert into _rls_results (test_name, status, detail)
    values ('owner.insert_content', 'fail', SQLERRM);
  end;

  begin
    insert into public.content_v2 (
      org_id,
      workspace_id,
      creator_id,
      type,
      status,
      data,
      created_by
    )
    values (
      candidate.org_id,
      candidate.workspace_id,
      creator_id,
      'post',
      'client_review',
      jsonb_build_object('source', 'rls_regression', 'test', 'viewer_approval_transition'),
      candidate.owner_user_id
    )
    returning id into owner_review_content_id;

    insert into _rls_results (test_name, status, detail)
    values ('owner.seed_client_review_content', 'pass', null);
  exception when others then
    insert into _rls_results (test_name, status, detail)
    values ('owner.seed_client_review_content', 'fail', SQLERRM);
  end;

  perform set_config('request.jwt.claim.sub', candidate.editor_user_id::text, true);

  if owner_draft_content_id is not null then
    begin
      insert into public.schedules_v2 (
        org_id,
        workspace_id,
        content_id,
        platform,
        scheduled_for,
        status
      )
      values (
        candidate.org_id,
        candidate.workspace_id,
        owner_draft_content_id,
        'instagram',
        now() + interval '1 hour',
        'scheduled'
      )
      returning id into editor_schedule_id;

      insert into _rls_results (test_name, status, detail)
      values ('editor.insert_schedule', 'pass', null);
    exception when others then
      insert into _rls_results (test_name, status, detail)
      values ('editor.insert_schedule', 'fail', SQLERRM);
    end;
  else
    insert into _rls_results (test_name, status, detail)
    values ('editor.insert_schedule', 'skipped', 'owner draft content seed failed');
  end if;

  begin
    insert into public.workspaces_v2 (org_id, name, client_visible)
    values (candidate.org_id, 'editor-should-not-create-' || gen_random_uuid()::text, false);

    insert into _rls_results (test_name, status, detail)
    values ('editor.create_workspace_denied', 'fail', 'Editor unexpectedly created workspace');
  exception when others then
    insert into _rls_results (test_name, status, detail)
    values ('editor.create_workspace_denied', 'pass', SQLERRM);
  end;

  perform set_config('request.jwt.claim.sub', candidate.viewer_user_id::text, true);

  begin
    insert into public.content_v2 (
      org_id,
      workspace_id,
      creator_id,
      type,
      status,
      data,
      created_by
    )
    values (
      candidate.org_id,
      candidate.workspace_id,
      creator_id,
      'post',
      'draft',
      jsonb_build_object('source', 'rls_regression', 'test', 'viewer_insert_denied'),
      candidate.viewer_user_id
    );

    insert into _rls_results (test_name, status, detail)
    values ('viewer.insert_content_denied', 'fail', 'Viewer unexpectedly inserted content');
  exception when others then
    insert into _rls_results (test_name, status, detail)
    values ('viewer.insert_content_denied', 'pass', SQLERRM);
  end;

  if owner_review_content_id is not null then
    begin
      update public.content_v2
      set status = 'internal_review'
      where id = owner_review_content_id;

      get diagnostics visible_rows = row_count;

      if visible_rows = 1 then
        insert into _rls_results (test_name, status, detail)
        values ('viewer.approve_client_review', 'pass', null);
      else
        insert into _rls_results (test_name, status, detail)
        values ('viewer.approve_client_review', 'fail', 'Update affected 0 rows');
      end if;
    exception when others then
      insert into _rls_results (test_name, status, detail)
      values ('viewer.approve_client_review', 'fail', SQLERRM);
    end;
  else
    insert into _rls_results (test_name, status, detail)
    values ('viewer.approve_client_review', 'skipped', 'client_review seed content missing');
  end if;

  perform set_config('request.jwt.claim.sub', candidate.owner_user_id::text, true);
  if owner_review_content_id is not null then
    update public.content_v2
    set status = 'client_review'
    where id = owner_review_content_id;
  end if;

  perform set_config('request.jwt.claim.sub', candidate.viewer_user_id::text, true);

  if owner_review_content_id is not null then
    begin
      update public.content_v2
      set status = 'scheduled'
      where id = owner_review_content_id;

      get diagnostics visible_rows = row_count;

      if visible_rows = 0 then
        insert into _rls_results (test_name, status, detail)
        values ('viewer.schedule_status_denied', 'pass', 'No rows updated');
      else
        insert into _rls_results (test_name, status, detail)
        values ('viewer.schedule_status_denied', 'fail', 'Viewer unexpectedly changed status');
      end if;
    exception when others then
      insert into _rls_results (test_name, status, detail)
      values ('viewer.schedule_status_denied', 'pass', SQLERRM);
    end;

    begin
      update public.content_v2
      set data = jsonb_build_object('tampered', true)
      where id = owner_review_content_id;

      get diagnostics visible_rows = row_count;

      if visible_rows = 0 then
        insert into _rls_results (test_name, status, detail)
        values ('viewer.data_update_denied', 'pass', 'No rows updated');
      else
        insert into _rls_results (test_name, status, detail)
        values ('viewer.data_update_denied', 'fail', 'Viewer unexpectedly changed data');
      end if;
    exception when others then
      insert into _rls_results (test_name, status, detail)
      values ('viewer.data_update_denied', 'pass', SQLERRM);
    end;
  else
    insert into _rls_results (test_name, status, detail)
    values ('viewer.schedule_status_denied', 'skipped', 'client_review seed content missing');

    insert into _rls_results (test_name, status, detail)
    values ('viewer.data_update_denied', 'skipped', 'client_review seed content missing');
  end if;

  select workspace.id
  into same_org_unassigned_workspace_id
  from public.workspaces_v2 workspace
  where workspace.org_id = candidate.org_id
    and workspace.id <> candidate.workspace_id
    and not exists (
      select 1
      from public.workspace_members_v2 member
      where member.workspace_id = workspace.id
        and member.user_id = candidate.viewer_user_id
    )
  limit 1;

  if same_org_unassigned_workspace_id is null then
    insert into _rls_results (test_name, status, detail)
    values (
      'viewer.workspace_isolation_same_org',
      'skipped',
      'No additional workspace in same org without viewer membership'
    );
  else
    select count(*)
    into visible_rows
    from public.creators_v2 creator
    where creator.workspace_id = same_org_unassigned_workspace_id;

    if visible_rows = 0 then
      insert into _rls_results (test_name, status, detail)
      values ('viewer.workspace_isolation_same_org', 'pass', null);
    else
      insert into _rls_results (test_name, status, detail)
      values (
        'viewer.workspace_isolation_same_org',
        'fail',
        'Viewer can see creators in workspace without membership'
      );
    end if;
  end if;

  select workspace.id
  into other_org_workspace_id
  from public.workspaces_v2 workspace
  where workspace.org_id <> candidate.org_id
  limit 1;

  if other_org_workspace_id is null then
    insert into _rls_results (test_name, status, detail)
    values (
      'viewer.org_isolation',
      'skipped',
      'No secondary org workspace available for isolation check'
    );
  else
    select count(*)
    into visible_rows
    from public.creators_v2 creator
    where creator.workspace_id = other_org_workspace_id;

    if visible_rows = 0 then
      insert into _rls_results (test_name, status, detail)
      values ('viewer.org_isolation', 'pass', null);
    else
      insert into _rls_results (test_name, status, detail)
      values ('viewer.org_isolation', 'fail', 'Viewer can see creators from another org');
    end if;
  end if;
end
$$;

select test_name, status, detail
from _rls_results
order by test_name;

select status, count(*) as total
from _rls_results
group by status
order by status;

rollback;
