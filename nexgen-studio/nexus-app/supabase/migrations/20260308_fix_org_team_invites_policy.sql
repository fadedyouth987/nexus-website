-- Fix compatibility for legacy organization_members join column naming.

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

select '20260308_fix_org_team_invites_policy.sql finished' as ok;

