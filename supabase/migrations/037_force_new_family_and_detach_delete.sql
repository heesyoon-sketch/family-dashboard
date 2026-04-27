-- Migration 037: Force clean family recreation and detached family deletion.
--
-- Critical guarantees:
--   1. setup_family never returns an existing family.
--   2. setup_family detaches the caller from every previous user row first.
--   3. setup_family creates the default profiles inside the new family and links
--      auth.uid() to the new parent profile immediately.
--   4. admin_delete_family detaches all users in the target family before
--      deleting any family data.

create or replace function public.setup_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id   uuid := auth.uid();
  v_owner_email text;
  v_family_id  uuid;
  v_name       text := nullif(trim(coalesce(p_name, '')), '');
begin
  if v_owner_id is null then
    raise exception 'Authentication required';
  end if;
  if v_name is null then
    raise exception 'Family name is required';
  end if;

  select lower(email) into v_owner_email
  from auth.users
  where id = v_owner_id;

  -- Forcefully detach this auth user from every previous profile first.
  update public.users
  set auth_user_id = null,
      login_method  = case when login_method = 'google' then 'device' else login_method end
  where auth_user_id = v_owner_id;

  -- Release old family ownership so the caller becomes fully unassociated.
  update public.families
  set owner_id = null
  where owner_id = v_owner_id;

  -- Always create a new family row. No idempotency shortcut is allowed here.
  insert into public.families (owner_id, name)
  values (v_owner_id, v_name)
  returning id into v_family_id;

  -- Always seed the default profiles into the newly-created family only.
  -- The first parent profile is the creator's new profile.
  insert into public.users (
    id, name, role, theme, family_id, auth_user_id, avatar_url, email, login_method, created_at
  ) values
    (gen_random_uuid()::text, '아빠', 'PARENT', 'dark_minimal',
     v_family_id, v_owner_id, null, v_owner_email, 'google', now()),
    (gen_random_uuid()::text, '엄마',  'PARENT', 'warm_minimal',
     v_family_id, null, null, null, 'device', now()),
    (gen_random_uuid()::text, '아이1', 'CHILD',  'robot_neon',
     v_family_id, null, null, null, 'device', now()),
    (gen_random_uuid()::text, '아이2', 'CHILD',  'pastel_cute',
     v_family_id, null, null, null, 'device', now());

  return v_family_id;
exception
  when unique_violation then
    raise exception 'setup_family unique violation: %', sqlerrm;
  when others then
    raise exception 'setup_family failed: %', sqlerrm;
end;
$$;

grant execute on function public.setup_family(text) to authenticated;

create or replace function public.admin_delete_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id  uuid;
  v_user_ids   text[];
  v_reward_ids uuid[];
begin
  select id into v_family_id
  from public.families
  where owner_id = auth.uid()
  limit 1;

  if v_family_id is null then
    raise exception 'Only the family owner can delete the family';
  end if;

  -- Detach every profile in the family before deleting data so no session can
  -- keep resolving to this tenant while the cascade runs.
  update public.users
  set auth_user_id = null,
      login_method  = case when login_method = 'google' then 'device' else login_method end
  where family_id = v_family_id;

  update public.families
  set owner_id = null
  where id = v_family_id;

  select array_agg(id) into v_user_ids
  from public.users
  where family_id = v_family_id;

  select array_agg(id) into v_reward_ids
  from public.rewards
  where family_id = v_family_id;

  if v_user_ids is not null then
    delete from public.task_completions where user_id = any(v_user_ids);
    delete from public.streaks where user_id = any(v_user_ids);
    delete from public.levels where user_id = any(v_user_ids);
    delete from public.user_badges where user_id = any(v_user_ids);
    delete from public.reward_redemptions where user_id::text = any(v_user_ids);
  end if;

  if v_reward_ids is not null then
    delete from public.reward_redemptions where reward_id = any(v_reward_ids);
  end if;

  delete from public.tasks where family_id = v_family_id;
  delete from public.rewards where family_id = v_family_id;
  delete from public.family_settings where family_id = v_family_id;
  delete from public.users where family_id = v_family_id;
  delete from public.families where id = v_family_id;
end;
$$;

grant execute on function public.admin_delete_family() to authenticated;

create or replace function public.delete_family_as_owner()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_delete_family();
end;
$$;

grant execute on function public.delete_family_as_owner() to authenticated;
