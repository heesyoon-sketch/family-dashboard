-- Migration 034: Strict Multi-Tenant Isolation
--
-- Root cause of cross-family data leakage:
--   1. setup_family() returned the OLD family early (idempotency shortcut from 031)
--      without clearing ghost auth_user_id links — the clean-slate logic from 030 was
--      accidentally reverted.
--   2. get_my_family_id() ordered by ASC (oldest link wins) so ghost links in old
--      families took precedence over the new family.
--   3. No UNIQUE constraint prevented one auth user from linking to multiple families.
--   4. seed_default_family_data() resolved family via get_my_family_id() which can
--      be null right after setup_family() creates an empty family.
--   5. families table lost its UPDATE policy in migration 029 (invite code gen broken).
--   6. RLS policies were inconsistent — some used is_family_member(), others
--      used get_my_family_id().
--
-- This migration fixes all of the above in one atomic pass.

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: Clean up existing ghost auth_user_id links
-- Keep only the NEWEST family link per auth user (by family.created_at DESC).
-- ══════════════════════════════════════════════════════════════════════════════
do $$
declare
  v_dup_auth uuid;
  v_keep_user_id text;
begin
  for v_dup_auth in (
    select auth_user_id
    from public.users
    where auth_user_id is not null
    group by auth_user_id
    having count(*) > 1
  ) loop
    -- Keep the link in the newest family; null out all others.
    select u.id into v_keep_user_id
    from public.users u
    join public.families f on f.id = u.family_id
    where u.auth_user_id = v_dup_auth
    order by f.created_at desc, u.created_at desc
    limit 1;

    update public.users
    set auth_user_id = null,
        login_method  = case when login_method = 'google' then 'device' else login_method end
    where auth_user_id = v_dup_auth
      and id <> v_keep_user_id;
  end loop;
end;
$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: Enforce one-family-per-auth-user at the DB level
-- ══════════════════════════════════════════════════════════════════════════════
create unique index if not exists users_auth_user_id_unique
  on public.users(auth_user_id)
  where auth_user_id is not null;

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: Fix get_my_family_id() — prefer NEWEST link (order DESC)
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.get_my_family_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select u.family_id
  from public.users u
  where u.auth_user_id = auth.uid()
    and u.family_id is not null
  order by u.created_at desc
  limit 1
$$;

grant execute on function public.get_my_family_id() to authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: Fix prepare_create_family() — always null owner unconditionally
-- ══════════════════════════════════════════════════════════════════════════════
create or replace function public.prepare_create_family()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id uuid := auth.uid();
begin
  if v_auth_id is null then
    raise exception 'Authentication required';
  end if;

  -- Null every auth link for this user across all families.
  update public.users
  set auth_user_id = null,
      login_method  = case when login_method = 'google' then 'device' else login_method end
  where auth_user_id = v_auth_id;

  -- Release ownership of every family unconditionally.
  -- (Previous version had a conditional "not exists" guard that could silently skip
  -- the update when auth links hadn't been cleared yet.)
  update public.families
  set owner_id = null
  where owner_id = v_auth_id;
end;
$$;

grant execute on function public.prepare_create_family() to authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: Fix setup_family() — atomic clean-slate, no idempotency shortcut
--
-- The idempotency shortcut introduced in migration 031 returned the old family
-- without clearing ghost links. The clean-slate logic from migration 030 is
-- restored and made atomic: auth links + family ownership are always cleared
-- inside the same transaction before creating the new family.
-- ══════════════════════════════════════════════════════════════════════════════
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

  -- STEP 1: Forcefully clear every ghost auth_user_id link for this user.
  -- This prevents the caller's session from resolving to a stale family.
  update public.users
  set auth_user_id = null,
      login_method  = case when login_method = 'google' then 'device' else login_method end
  where auth_user_id = v_owner_id;

  -- STEP 2: Release ownership of every previous family.
  update public.families
  set owner_id = null
  where owner_id = v_owner_id;

  -- STEP 3: Create the new family.
  insert into public.families (owner_id, name)
  values (v_owner_id, v_name)
  returning id into v_family_id;

  -- STEP 4: Caller must invoke seed_default_family_data(p_family_id => v_family_id)
  -- to seed members. Seeding is separate so the family_id can be passed explicitly.
  return v_family_id;
exception
  when unique_violation then
    raise exception 'setup_family unique violation for auth user %: %', v_owner_id, sqlerrm;
  when others then
    raise exception 'setup_family failed for auth user %: %', v_owner_id, sqlerrm;
end;
$$;

grant execute on function public.setup_family(text) to authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: Fix seed_default_family_data() — accept explicit p_family_id
--
-- The old signature relied on get_my_family_id() which is null immediately after
-- setup_family() creates an empty family (no users → no auth link yet). The new
-- version takes an explicit p_family_id so the caller can pass the id returned
-- by setup_family() directly. Falls back to owner lookup if omitted.
-- ══════════════════════════════════════════════════════════════════════════════
drop function if exists public.seed_default_family_data(text, text);

create or replace function public.seed_default_family_data(
  p_family_id     uuid    default null,
  p_admin_name    text    default null,
  p_admin_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_id     uuid := auth.uid();
  v_auth_email  text;
  v_family_id   uuid := p_family_id;
  v_user_count  integer;
  v_reward_count integer;
  v_admin_name  text := nullif(trim(coalesce(p_admin_name, '')), '');
  v_admin_avatar text := nullif(trim(coalesce(p_admin_avatar_url, '')), '');
begin
  if v_auth_id is null then
    raise exception 'Authentication required';
  end if;

  select lower(email) into v_auth_email
  from auth.users
  where id = v_auth_id;

  -- Resolve family: use explicit param first, then owner lookup.
  -- Do NOT fall back to get_my_family_id() here — immediately after setup_family()
  -- creates an empty family there are no user rows yet, so get_my_family_id() = null.
  if v_family_id is null then
    select id into v_family_id
    from public.families
    where owner_id = v_auth_id
    order by created_at desc
    limit 1;
  end if;

  if v_family_id is null then
    raise exception 'No family found. Pass p_family_id from setup_family() result.';
  end if;

  -- Verify the caller is the owner of the target family.
  if not exists (
    select 1 from public.families
    where id = v_family_id and owner_id = v_auth_id
  ) then
    raise exception 'Caller is not the owner of family %', v_family_id;
  end if;

  select count(*) into v_user_count
  from public.users
  where family_id = v_family_id;

  if v_user_count = 0 then
    -- STEP 3 of setup: create default members for THIS family only.
    -- The users_ensure_default_tasks trigger fires after each INSERT and
    -- creates the three default habits per member automatically.
    insert into public.users (
      id, name, role, theme, family_id, auth_user_id, avatar_url, email, login_method, created_at
    ) values
      (gen_random_uuid()::text, coalesce(v_admin_name, '아빠'), 'PARENT', 'dark_minimal',
       v_family_id, v_auth_id, v_admin_avatar, v_auth_email, 'google', now()),
      (gen_random_uuid()::text, '엄마',  'PARENT', 'warm_minimal', v_family_id, null, null, null, 'device', now()),
      (gen_random_uuid()::text, '아이1', 'CHILD',  'robot_neon',   v_family_id, null, null, null, 'device', now()),
      (gen_random_uuid()::text, '아이2', 'CHILD',  'pastel_cute',  v_family_id, null, null, null, 'device', now());
  elsif not exists (
    select 1 from public.users
    where family_id = v_family_id and auth_user_id = v_auth_id
  ) then
    -- STEP 4 (alternative): link caller to the first PARENT slot in an existing family.
    update public.users
    set auth_user_id = v_auth_id,
        role         = 'PARENT',
        email        = coalesce(email, v_auth_email),
        login_method = 'google'
    where id = (
      select id from public.users
      where family_id = v_family_id
      order by case when role = 'PARENT' then 0 else 1 end, created_at asc
      limit 1
    );
  else
    update public.users
    set role         = 'PARENT',
        email        = coalesce(email, v_auth_email),
        login_method = 'google'
    where family_id  = v_family_id
      and auth_user_id = v_auth_id;
  end if;

  select count(*) into v_reward_count
  from public.rewards
  where family_id = v_family_id;

  if v_reward_count = 0 then
    insert into public.rewards (id, title, icon, cost_points, family_id)
    values
      (gen_random_uuid(), '아이스크림', 'ice-cream', 50,  v_family_id),
      (gen_random_uuid(), '게임 30분',  'gamepad-2', 100, v_family_id),
      (gen_random_uuid(), '영화 보기',  'tv',        200, v_family_id);
  end if;
end;
$$;

grant execute on function public.seed_default_family_data(uuid, text, text) to authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- SECTION 7: Rebuild all RLS policies with consistent get_my_family_id() anchor
--
-- Every policy now uses:
--   direct tables:  family_id = public.get_my_family_id()
--   child tables:   user_id IN (SELECT id FROM users WHERE family_id = get_my_family_id())
--
-- With the UNIQUE INDEX in Section 2, get_my_family_id() returns at most one
-- family, making these policies equivalent to the requested
--   USING (family_id = (SELECT family_id FROM users WHERE auth_user_id = auth.uid()))
-- ══════════════════════════════════════════════════════════════════════════════

-- ── families ─────────────────────────────────────────────────────────────────
drop policy if exists "families_owner"         on public.families;
drop policy if exists "families_member_select" on public.families;
drop policy if exists "families_owner_update"  on public.families;

-- Members can read their own family row.
create policy "families_member_select" on public.families
  for select to authenticated
  using (id = public.get_my_family_id());

-- Owner can update their own family (e.g. invite_code, name).
create policy "families_owner_update" on public.families
  for update to authenticated
  using     (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ── users ─────────────────────────────────────────────────────────────────────
drop policy if exists "users_family"           on public.users;
drop policy if exists "users_family_select"    on public.users;
drop policy if exists "users_parent_insert"    on public.users;
drop policy if exists "users_parent_update"    on public.users;
drop policy if exists "users_parent_delete"    on public.users;

create policy "users_family_select" on public.users
  for select to authenticated
  using (family_id = public.get_my_family_id());

create policy "users_parent_insert" on public.users
  for insert to authenticated
  with check (family_id = public.get_my_family_id() and public.is_my_family_parent());

create policy "users_parent_update" on public.users
  for update to authenticated
  using     (family_id = public.get_my_family_id() and public.is_my_family_parent())
  with check (family_id = public.get_my_family_id() and public.is_my_family_parent());

create policy "users_parent_delete" on public.users
  for delete to authenticated
  using (family_id = public.get_my_family_id() and public.is_my_family_parent());

-- ── tasks ─────────────────────────────────────────────────────────────────────
drop policy if exists "tasks_family"           on public.tasks;
drop policy if exists "tasks_family_select"    on public.tasks;
drop policy if exists "tasks_parent_insert"    on public.tasks;
drop policy if exists "tasks_parent_update"    on public.tasks;
drop policy if exists "tasks_parent_delete"    on public.tasks;

create policy "tasks_family_select" on public.tasks
  for select to authenticated
  using (family_id = public.get_my_family_id());

create policy "tasks_parent_insert" on public.tasks
  for insert to authenticated
  with check (family_id = public.get_my_family_id() and public.is_my_family_parent());

create policy "tasks_parent_update" on public.tasks
  for update to authenticated
  using     (family_id = public.get_my_family_id() and public.is_my_family_parent())
  with check (family_id = public.get_my_family_id() and public.is_my_family_parent());

create policy "tasks_parent_delete" on public.tasks
  for delete to authenticated
  using (family_id = public.get_my_family_id() and public.is_my_family_parent());

-- ── rewards ───────────────────────────────────────────────────────────────────
drop policy if exists "rewards_family"          on public.rewards;
drop policy if exists "rewards_family_select"   on public.rewards;
drop policy if exists "rewards_parent_insert"   on public.rewards;
drop policy if exists "rewards_parent_update"   on public.rewards;
drop policy if exists "rewards_parent_delete"   on public.rewards;

create policy "rewards_family_select" on public.rewards
  for select to authenticated
  using (family_id = public.get_my_family_id());

create policy "rewards_parent_insert" on public.rewards
  for insert to authenticated
  with check (family_id = public.get_my_family_id() and public.is_my_family_parent());

create policy "rewards_parent_update" on public.rewards
  for update to authenticated
  using     (family_id = public.get_my_family_id() and public.is_my_family_parent())
  with check (family_id = public.get_my_family_id() and public.is_my_family_parent());

create policy "rewards_parent_delete" on public.rewards
  for delete to authenticated
  using (family_id = public.get_my_family_id() and public.is_my_family_parent());

-- ── family_settings ───────────────────────────────────────────────────────────
drop policy if exists "family_settings_family"          on public.family_settings;
drop policy if exists "family_settings_family_select"   on public.family_settings;
drop policy if exists "family_settings_parent_insert"   on public.family_settings;
drop policy if exists "family_settings_parent_update"   on public.family_settings;
drop policy if exists "family_settings_parent_delete"   on public.family_settings;

create policy "family_settings_family_select" on public.family_settings
  for select to authenticated
  using (family_id = public.get_my_family_id());

create policy "family_settings_parent_insert" on public.family_settings
  for insert to authenticated
  with check (family_id = public.get_my_family_id() and public.is_my_family_parent());

create policy "family_settings_parent_update" on public.family_settings
  for update to authenticated
  using     (family_id = public.get_my_family_id() and public.is_my_family_parent())
  with check (family_id = public.get_my_family_id() and public.is_my_family_parent());

create policy "family_settings_parent_delete" on public.family_settings
  for delete to authenticated
  using (family_id = public.get_my_family_id() and public.is_my_family_parent());

-- ── task_completions ──────────────────────────────────────────────────────────
drop policy if exists "task_completions_family"        on public.task_completions;
drop policy if exists "task_completions_family_select" on public.task_completions;

create policy "task_completions_family_select" on public.task_completions
  for select to authenticated
  using (
    user_id in (
      select id from public.users
      where family_id = public.get_my_family_id()
    )
  );

-- ── streaks ───────────────────────────────────────────────────────────────────
drop policy if exists "streaks_family"        on public.streaks;
drop policy if exists "streaks_family_select" on public.streaks;

create policy "streaks_family_select" on public.streaks
  for select to authenticated
  using (
    user_id in (
      select id from public.users
      where family_id = public.get_my_family_id()
    )
  );

-- ── levels ────────────────────────────────────────────────────────────────────
drop policy if exists "levels_family"        on public.levels;
drop policy if exists "levels_family_select" on public.levels;

create policy "levels_family_select" on public.levels
  for select to authenticated
  using (
    user_id in (
      select id from public.users
      where family_id = public.get_my_family_id()
    )
  );

-- ── user_badges ───────────────────────────────────────────────────────────────
drop policy if exists "user_badges_family"        on public.user_badges;
drop policy if exists "user_badges_family_select" on public.user_badges;

create policy "user_badges_family_select" on public.user_badges
  for select to authenticated
  using (
    user_id in (
      select id from public.users
      where family_id = public.get_my_family_id()
    )
  );

-- ── reward_redemptions ────────────────────────────────────────────────────────
drop policy if exists "reward_redemptions_family"        on public.reward_redemptions;
drop policy if exists "reward_redemptions_family_select" on public.reward_redemptions;

create policy "reward_redemptions_family_select" on public.reward_redemptions
  for select to authenticated
  using (
    -- reward_redemptions.user_id is UUID; users.id is text
    user_id::text in (
      select id from public.users
      where family_id = public.get_my_family_id()
    )
  );
