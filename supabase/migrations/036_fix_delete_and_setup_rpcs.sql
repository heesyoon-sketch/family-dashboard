-- Migration 036: Fix delete_family_as_owner and re-apply setup_family
--
-- Bug 1 – delete_family_as_owner found the family only by owner_id = auth.uid().
--   After setup_family (034) nulls the old family's owner_id before creating a new
--   one, the old family is unreachable via that lookup. The delete would silently
--   target the NEW (empty) family instead, leaving all old data in the DB.
--   Fix: null all auth links first, then cascade-delete by auth link OR owner.
--
-- Bug 2 – setup_family was correct in 034 but is re-applied here for clarity.

-- ── 1. delete_family_as_owner ─────────────────────────────────────────────────
create or replace function public.delete_family_as_owner()
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
  -- Find the family to delete.
  -- Primary: family owned by the caller (exact ownership).
  -- Fallback: family the caller is linked to as a member
  --           (handles cases where setup_family already nulled the old owner_id
  --            before the user clicked delete, so the "old" family has owner=null
  --            but the user's auth link still points there).
  select id into v_family_id
  from public.families
  where owner_id = auth.uid()
  limit 1;

  if v_family_id is null then
    v_family_id := public.get_my_family_id();
  end if;

  if v_family_id is null then
    raise exception 'No family found for current user';
  end if;

  -- Step 1: detach every auth link in this family immediately.
  -- This ensures that after the RPC returns, get_my_family_id() = null for
  -- all users that were in this family, so no stale session resolves to it.
  update public.users
  set auth_user_id = null,
      login_method  = case when login_method = 'google' then 'device' else login_method end
  where family_id = v_family_id;

  -- Step 2: collect IDs for cascade deletion.
  select array_agg(id) into v_user_ids
  from public.users
  where family_id = v_family_id;

  select array_agg(id) into v_reward_ids
  from public.rewards
  where family_id = v_family_id;

  -- Step 3: cascade.
  if v_user_ids is not null then
    delete from public.task_completions where user_id    = any(v_user_ids);
    delete from public.streaks           where user_id    = any(v_user_ids);
    delete from public.levels            where user_id    = any(v_user_ids);
    delete from public.user_badges       where user_id    = any(v_user_ids);
    delete from public.reward_redemptions where user_id::text = any(v_user_ids);
  end if;

  if v_reward_ids is not null then
    delete from public.reward_redemptions where reward_id = any(v_reward_ids);
  end if;

  delete from public.tasks          where family_id = v_family_id;
  delete from public.rewards        where family_id = v_family_id;
  delete from public.family_settings where family_id = v_family_id;
  delete from public.users          where family_id = v_family_id;
  delete from public.families       where id        = v_family_id;
end;
$$;

grant execute on function public.delete_family_as_owner() to authenticated;

-- ── 2. setup_family – re-apply to ensure clean-slate is active ────────────────
create or replace function public.setup_family(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id  uuid := auth.uid();
  v_family_id uuid;
  v_name      text := nullif(trim(coalesce(p_name, '')), '');
begin
  if v_owner_id is null then
    raise exception 'Authentication required';
  end if;
  if v_name is null then
    raise exception 'Family name is required';
  end if;

  -- Always null every existing auth link for this user first.
  update public.users
  set auth_user_id = null,
      login_method  = case when login_method = 'google' then 'device' else login_method end
  where auth_user_id = v_owner_id;

  -- Always null ownership of every previous family.
  update public.families
  set owner_id = null
  where owner_id = v_owner_id;

  -- Create the new family and return its ID.
  -- No idempotency check — caller always gets a brand-new family.
  insert into public.families (owner_id, name)
  values (v_owner_id, v_name)
  returning id into v_family_id;

  return v_family_id;
exception
  when unique_violation then
    raise exception 'setup_family unique violation: %', sqlerrm;
  when others then
    raise exception 'setup_family failed: %', sqlerrm;
end;
$$;

grant execute on function public.setup_family(text) to authenticated;
