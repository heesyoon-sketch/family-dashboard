-- Migration 025: Family owner PIN reset and auto-promote CHILD→PARENT
--
-- Fixes two issues:
-- 1. Family owner stuck as CHILD role (claim_owner_parent_profile skipped them
--    because they were already linked, but with wrong role)
-- 2. Family owner locked out of admin because PIN was set and they forgot it
--    (no escape path existed)

-- ── 1. is_family_owner() ──────────────────────────────────────────────────────
-- Returns true if the calling auth user created this family (owner_id match).
-- Used by the frontend to decide whether to show the PIN reset escape hatch.
create or replace function public.is_family_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.families
    where owner_id = auth.uid()
  );
$$;

grant execute on function public.is_family_owner() to authenticated;

-- ── 2. claim_owner_parent_profile (fix) ──────────────────────────────────────
-- Previous version returned early when the owner already had any linked profile,
-- even if that profile was role=CHILD. Now we also promote CHILD→PARENT when
-- the caller is the family's owner.
create or replace function public.claim_owner_parent_profile()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id   uuid := auth.uid();
  v_family_id uuid;
  v_profile_id text;
begin
  if v_auth_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Only act on families created by this user
  select id into v_family_id
  from public.families
  where owner_id = v_auth_id
  limit 1;

  if v_family_id is null then
    return; -- not a family creator, nothing to do
  end if;

  -- If already linked as PARENT, nothing to do
  if exists (
    select 1 from public.users
    where auth_user_id = v_auth_id
      and family_id    = v_family_id
      and role         = 'PARENT'
  ) then
    return;
  end if;

  -- If linked as CHILD (happens when login flow goes wrong), promote to PARENT
  if exists (
    select 1 from public.users
    where auth_user_id = v_auth_id
      and family_id    = v_family_id
      and role         = 'CHILD'
  ) then
    update public.users
    set role = 'PARENT'
    where auth_user_id = v_auth_id
      and family_id    = v_family_id;
    return;
  end if;

  -- Not linked at all — attach to the first unlinked PARENT slot
  select id into v_profile_id
  from public.users
  where family_id    = v_family_id
    and role         = 'PARENT'
    and auth_user_id is null
  order by created_at asc
  limit 1;

  if v_profile_id is not null then
    update public.users
    set auth_user_id = v_auth_id
    where id = v_profile_id;
  end if;
end;
$$;

grant execute on function public.claim_owner_parent_profile() to authenticated;

-- ── 3. admin_clear_pin_for_owner() ───────────────────────────────────────────
-- Clears the family admin PIN for the family owner. The caller's identity is
-- already proven by their Google session (middleware + getUser()), so no
-- additional email OTP is needed. Only the family creator can call this.
create or replace function public.admin_clear_pin_for_owner()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_family_id uuid;
begin
  select id into v_family_id
  from public.families
  where owner_id = auth.uid()
  limit 1;

  if v_family_id is null then
    raise exception 'Only the family creator can reset the PIN this way.';
  end if;

  -- Remove pin from family_settings (primary storage)
  delete from public.family_settings
  where family_id = v_family_id
    and key       = 'admin_pin_hash';

  -- Also clear any legacy per-user pin_hash on PARENT profiles
  update public.users
  set pin_hash = null
  where family_id = v_family_id
    and role      = 'PARENT';
end;
$$;

grant execute on function public.admin_clear_pin_for_owner() to authenticated;
