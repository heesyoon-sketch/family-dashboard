-- Migration 026: Allow family owner to delete their own family data
-- deleteCurrentFamilyData() frontend checks is_my_family_parent which fails
-- when the owner is still CHILD role. This RPC runs as SECURITY DEFINER and
-- only requires owner_id = auth.uid().

create or replace function public.delete_family_as_owner()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
  v_user_ids  text[];
  v_reward_ids text[];
begin
  select id into v_family_id
  from public.families
  where owner_id = auth.uid()
  limit 1;

  if v_family_id is null then
    raise exception 'Only the family creator can delete the family this way.';
  end if;

  -- Collect IDs for cascading deletes
  select array_agg(id) into v_user_ids
  from public.users where family_id = v_family_id;

  select array_agg(id) into v_reward_ids
  from public.rewards where family_id = v_family_id;

  -- Delete child-table rows first (FK constraints)
  if v_user_ids is not null then
    delete from public.task_completions  where user_id  = any(v_user_ids);
    delete from public.streaks           where user_id  = any(v_user_ids);
    delete from public.levels            where user_id  = any(v_user_ids);
    delete from public.user_badges       where user_id  = any(v_user_ids);
    delete from public.reward_redemptions where user_id = any(v_user_ids::uuid[]);
  end if;

  if v_reward_ids is not null then
    delete from public.reward_redemptions where reward_id = any(v_reward_ids::uuid[]);
  end if;

  delete from public.tasks            where family_id = v_family_id;
  delete from public.rewards          where family_id = v_family_id;
  delete from public.family_settings  where family_id = v_family_id;
  delete from public.users            where family_id = v_family_id;
  delete from public.families         where id        = v_family_id;
end;
$$;

grant execute on function public.delete_family_as_owner() to authenticated;
