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
  v_receiver_a text;
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

  select id into v_receiver_a
  from public.users
  where family_id = v_family_a and id <> v_user_a
  order by created_at, id
  limit 1;
  if v_receiver_a is null then
    raise exception 'RLS test needs two members in family A';
  end if;

  if has_function_privilege('anon', 'public.prune_old_task_activities()'::regprocedure, 'EXECUTE')
    or has_function_privilege('anon', 'public.link_auth_user_to_profile(text,uuid)'::regprocedure, 'EXECUTE')
  then
    raise exception 'anon can execute internal SECURITY DEFINER functions';
  end if;

  perform set_config('rls_test.family_a', v_family_a::text, true);
  perform set_config('rls_test.user_a', v_user_a, true);
  perform set_config('rls_test.auth_a', v_auth_a::text, true);
  perform set_config('rls_test.receiver_a', v_receiver_a, true);
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

  insert into public.levels (user_id, current_level, total_points, spendable_balance, updated_at)
  values
    (v_user_a, 1, 100, 100, now()),
    (v_receiver_a, 1, 100, 100, now())
  on conflict (user_id) do nothing;
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
  v_receiver_a text := current_setting('rls_test.receiver_a');
  v_count integer;
  v_rows integer;
  v_before_total integer;
  v_after_total integer;
  v_first_award jsonb;
  v_duplicate_award jsonb;
  v_transfer_request_id uuid := gen_random_uuid();
  v_first_transfer jsonb;
  v_duplicate_transfer jsonb;
  v_sender_balance_before integer;
  v_receiver_balance_before integer;
  v_unauthorized_transfer_blocked boolean := false;
  v_cross_insert_blocked boolean := false;
  v_cross_rpc_blocked boolean := false;
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

  perform public.replace_achievement_state_intent(
    v_family_a,
    v_user_a,
    '["rpc-a-exact"]'::jsonb,
    '[]'::jsonb,
    '{}'::jsonb
  );
  select count(*) into v_count
  from public.achievement_states
  where family_id = v_family_a
    and user_id = v_user_a
    and equipped_insignia_ids = '["rpc-a-exact"]'::jsonb;
  if v_count <> 1 then
    raise exception 'auth A exact intent RPC failed';
  end if;

  -- A generic stale client cannot remove the exact loadout.
  -- PostgREST runs each RPC in its own transaction; this test wraps everything
  -- in one rollback transaction, so explicitly end the RPC's local bypass.
  perform set_config('app.allow_achievement_state_replace', 'off', true);
  update public.achievement_states
  set equipped_insignia_ids = '[]'::jsonb
  where family_id = v_family_a and user_id = v_user_a;
  select count(*) into v_count
  from public.achievement_states
  where family_id = v_family_a
    and user_id = v_user_a
    and equipped_insignia_ids = '["rpc-a-exact"]'::jsonb;
  if v_count <> 1 then
    raise exception 'stale generic update removed auth A loadout';
  end if;

  begin
    perform public.replace_achievement_state_intent(
      v_family_b,
      v_user_b,
      '["rpc-cross-family"]'::jsonb,
      '[]'::jsonb,
      '{}'::jsonb
    );
  exception when others then
    v_cross_rpc_blocked := true;
  end;
  if not v_cross_rpc_blocked then
    raise exception 'auth A cross-family intent RPC unexpectedly succeeded';
  end if;

  perform public.merge_achievement_unlock_state(
    v_family_a,
    v_user_a,
    '{"rls-shield":"2026-06-20T00:00:00.000Z"}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '2026-05-09T00:00:00.000Z'::timestamptz
  );
  perform set_config('app.allow_achievement_state_replace', 'off', true);
  update public.achievement_states
  set unlocked_at_by_achievement_id = '{"legacy-extra":"2026-06-20T00:00:00.000Z"}'::jsonb
  where family_id = v_family_a and user_id = v_user_a;
  select count(*) into v_count
  from public.achievement_states
  where family_id = v_family_a
    and user_id = v_user_a
    and unlocked_at_by_achievement_id ? 'rls-shield'
    and not (unlocked_at_by_achievement_id ? 'legacy-extra');
  if v_count <> 1 then
    raise exception 'legacy generic update changed engine-owned unlock state';
  end if;

  select coalesce((
    select total_points from public.levels where user_id = v_user_a
  ), 0) into v_before_total;
  v_first_award := public.award_achievement_bonus(
    v_user_a, 'rls-idempotency-probe', 1, 'RLS idempotency probe'
  );
  v_duplicate_award := public.award_achievement_bonus(
    v_user_a, 'rls-idempotency-probe', 1, 'RLS duplicate probe'
  );
  select total_points into v_after_total
  from public.levels
  where user_id = v_user_a;
  if coalesce((v_first_award->>'awarded')::boolean, false) is not true
    or coalesce((v_duplicate_award->>'awarded')::boolean, true) is not false
    or v_after_total <> v_before_total + 1
  then
    raise exception 'achievement bonus RPC is not idempotent';
  end if;

  select spendable_balance into v_sender_balance_before
  from public.levels where user_id = v_user_a;
  select spendable_balance into v_receiver_balance_before
  from public.levels where user_id = v_receiver_a;
  if v_sender_balance_before < 1 then
    raise exception 'RLS transfer test sender has no balance';
  end if;

  v_first_transfer := public.transfer_points_with_message(
    v_user_a, v_receiver_a, 1, 'RLS transfer probe', v_transfer_request_id
  );
  v_duplicate_transfer := public.transfer_points_with_message(
    v_user_a, v_receiver_a, 1, 'RLS transfer probe', v_transfer_request_id
  );
  if coalesce((v_first_transfer->>'duplicate')::boolean, true) is not false
    or coalesce((v_duplicate_transfer->>'duplicate')::boolean, false) is not true
    or (select spendable_balance from public.levels where user_id = v_user_a) <> v_sender_balance_before - 1
    or (select spendable_balance from public.levels where user_id = v_receiver_a) <> v_receiver_balance_before + 1
    or (select count(*) from public.point_transactions where request_id = v_transfer_request_id) <> 1
  then
    raise exception 'point transfer RPC is not idempotent';
  end if;

  begin
    perform public.transfer_points_with_message(
      v_user_b, v_receiver_a, 1, 'cross-family probe', gen_random_uuid()
    );
  exception when others then
    v_unauthorized_transfer_blocked := true;
  end;
  if not v_unauthorized_transfer_blocked then
    raise exception 'cross-family sender impersonation unexpectedly succeeded';
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

select 'PASS: achievement_states RLS/RPC allows validated same-family changes, blocks cross-family writes, and rejects legacy shield mutations' as result;

rollback;
