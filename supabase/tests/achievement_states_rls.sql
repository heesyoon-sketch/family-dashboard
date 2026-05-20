-- RLS safety test for Shield Wall persistence.
--
-- Run:
--   npm run test:rls:shields
--
-- What this proves:
--   - a member of family A can read/update family A shield state
--   - a member of family A cannot read/update/insert family B shield state
--   - the same checks pass in the opposite direction for family B
--
-- Safety:
--   This file runs inside one transaction and ends with ROLLBACK. It may seed
--   temporary achievement_states rows for two existing auth-linked families,
--   but it leaves no production data behind.

begin;

do $$
declare
  v_family_a uuid;
  v_user_a text;
  v_auth_a uuid;
  v_family_b uuid;
  v_user_b text;
  v_auth_b uuid;
begin
  with ranked as (
    select
      family_id,
      id as user_id,
      auth_user_id,
      dense_rank() over (order by family_id) as family_rank,
      row_number() over (partition by family_id order by created_at, id) as member_rank
    from public.users
    where family_id is not null
      and auth_user_id is not null
  ), picked as (
    select *
    from ranked
    where member_rank = 1
      and family_rank in (1, 2)
  )
  select
    (max(family_id::text) filter (where family_rank = 1))::uuid,
    max(user_id) filter (where family_rank = 1),
    (max(auth_user_id::text) filter (where family_rank = 1))::uuid,
    (max(family_id::text) filter (where family_rank = 2))::uuid,
    max(user_id) filter (where family_rank = 2),
    (max(auth_user_id::text) filter (where family_rank = 2))::uuid
  into v_family_a, v_user_a, v_auth_a, v_family_b, v_user_b, v_auth_b
  from picked;

  if v_family_a is null or v_family_b is null then
    raise exception 'RLS test needs at least two families with auth-linked users';
  end if;

  perform set_config('rls_test.family_a', v_family_a::text, true);
  perform set_config('rls_test.user_a', v_user_a, true);
  perform set_config('rls_test.auth_a', v_auth_a::text, true);
  perform set_config('rls_test.family_b', v_family_b::text, true);
  perform set_config('rls_test.user_b', v_user_b, true);
  perform set_config('rls_test.auth_b', v_auth_b::text, true);

  -- Seed one row per family as the owner role. ROLLBACK below removes this.
  insert into public.achievement_states (
    family_id,
    user_id,
    unlocked_at_by_achievement_id,
    pinned_achievement_ids,
    equipped_insignia_ids
  ) values
    (v_family_a, v_user_a, '{}'::jsonb, '["rls-own-a"]'::jsonb, '[]'::jsonb),
    (v_family_b, v_user_b, '{}'::jsonb, '["rls-own-b"]'::jsonb, '[]'::jsonb)
  on conflict (family_id, user_id) do update set
    pinned_achievement_ids = excluded.pinned_achievement_ids,
    equipped_insignia_ids = excluded.equipped_insignia_ids;
end;
$$;

do $$
begin
  perform set_config('request.jwt.claim.sub', current_setting('rls_test.auth_a'), true);
end;
$$;

set local role authenticated;

do $$
declare
  v_family_a uuid := current_setting('rls_test.family_a')::uuid;
  v_user_a text := current_setting('rls_test.user_a');
  v_family_b uuid := current_setting('rls_test.family_b')::uuid;
  v_user_b text := current_setting('rls_test.user_b');
  v_count integer;
  v_rows integer;
  v_cross_insert_blocked boolean := false;
begin
  select count(*) into v_count
  from public.achievement_states
  where family_id = v_family_a and user_id = v_user_a;
  if v_count <> 1 then
    raise exception 'auth A same-family SELECT failed; expected 1, got %', v_count;
  end if;

  select count(*) into v_count
  from public.achievement_states
  where family_id = v_family_b and user_id = v_user_b;
  if v_count <> 0 then
    raise exception 'auth A cross-family SELECT leaked % row(s)', v_count;
  end if;

  update public.achievement_states
  set equipped_insignia_ids = '["rls-a-own-update"]'::jsonb
  where family_id = v_family_a and user_id = v_user_a;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'auth A same-family UPDATE failed; expected 1, got %', v_rows;
  end if;

  update public.achievement_states
  set equipped_insignia_ids = '["rls-a-cross-update"]'::jsonb
  where family_id = v_family_b and user_id = v_user_b;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'auth A cross-family UPDATE changed % row(s)', v_rows;
  end if;

  begin
    insert into public.achievement_states (family_id, user_id)
    values (v_family_b, v_user_a);
  exception when insufficient_privilege then
    v_cross_insert_blocked := true;
  end;
  if not v_cross_insert_blocked then
    raise exception 'auth A cross-family INSERT unexpectedly succeeded';
  end if;
end;
$$;

reset role;

do $$
begin
  perform set_config('request.jwt.claim.sub', current_setting('rls_test.auth_b'), true);
end;
$$;

set local role authenticated;

do $$
declare
  v_family_a uuid := current_setting('rls_test.family_a')::uuid;
  v_user_a text := current_setting('rls_test.user_a');
  v_family_b uuid := current_setting('rls_test.family_b')::uuid;
  v_user_b text := current_setting('rls_test.user_b');
  v_count integer;
  v_rows integer;
  v_cross_insert_blocked boolean := false;
begin
  select count(*) into v_count
  from public.achievement_states
  where family_id = v_family_b and user_id = v_user_b;
  if v_count <> 1 then
    raise exception 'auth B same-family SELECT failed; expected 1, got %', v_count;
  end if;

  select count(*) into v_count
  from public.achievement_states
  where family_id = v_family_a and user_id = v_user_a;
  if v_count <> 0 then
    raise exception 'auth B cross-family SELECT leaked % row(s)', v_count;
  end if;

  update public.achievement_states
  set equipped_insignia_ids = '["rls-b-own-update"]'::jsonb
  where family_id = v_family_b and user_id = v_user_b;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'auth B same-family UPDATE failed; expected 1, got %', v_rows;
  end if;

  update public.achievement_states
  set equipped_insignia_ids = '["rls-b-cross-update"]'::jsonb
  where family_id = v_family_a and user_id = v_user_a;
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then
    raise exception 'auth B cross-family UPDATE changed % row(s)', v_rows;
  end if;

  begin
    insert into public.achievement_states (family_id, user_id)
    values (v_family_a, v_user_b);
  exception when insufficient_privilege then
    v_cross_insert_blocked := true;
  end;
  if not v_cross_insert_blocked then
    raise exception 'auth B cross-family INSERT unexpectedly succeeded';
  end if;
end;
$$;

select 'PASS: achievement_states RLS allows same-family access and blocks cross-family SELECT/UPDATE/INSERT in both directions' as result;

rollback;
